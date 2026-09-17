use serde_json::{json, Value};
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

const PROGRESS_FILE: &str = "course-progress-v1.json";
const PROGRESS_BACKUP_FILE: &str = "course-progress-v1.backup.json";
const PROGRESS_TEMP_FILE: &str = "course-progress-v1.next.json";
const MAX_PROGRESS_BYTES: usize = 2 * 1024 * 1024;
const MAX_LEGACY_FILE_BYTES: u64 = 16 * 1024 * 1024;
const LEGACY_KEYS: [&[u8]; 3] = [
    b"java-linguo-progress-v3",
    b"java-linguo-progress-v2",
    b"studio-java-progress-v2",
];

#[derive(Default)]
pub struct ProgressStore(Mutex<()>);

impl ProgressStore {
    pub fn synchronized<T>(&self, action: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
        let _guard = self
            .0
            .lock()
            .map_err(|_| "Archivio progressi non disponibile".to_string())?;
        action()
    }
}

pub fn load(app: &AppHandle) -> Result<Option<String>, String> {
    let storage_root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Cartella dati non disponibile: {error}"))?;

    for filename in [PROGRESS_FILE, PROGRESS_BACKUP_FILE] {
        let path = storage_root.join(filename);
        if let Some(payload) = read_valid_payload(&path)? {
            return Ok(Some(payload));
        }
    }

    let legacy_root = storage_root
        .join("EBWebView")
        .join("Default")
        .join("Local Storage")
        .join("leveldb");
    let recovered = recover_legacy_directory(&legacy_root)?;

    if let Some(payload) = recovered.as_deref() {
        save_to_root(&storage_root, payload)?;
    }

    Ok(recovered)
}

pub fn save(app: &AppHandle, payload: &str) -> Result<(), String> {
    validate_payload(payload)?;
    let storage_root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Cartella dati non disponibile: {error}"))?;
    save_to_root(&storage_root, payload)
}

fn read_valid_payload(path: &Path) -> Result<Option<String>, String> {
    if !path.is_file() {
        return Ok(None);
    }

    let metadata = fs::metadata(path)
        .map_err(|error| format!("Impossibile leggere i metadati dei progressi: {error}"))?;
    if metadata.len() > MAX_PROGRESS_BYTES as u64 {
        return Ok(None);
    }

    let payload = fs::read_to_string(path)
        .map_err(|error| format!("Impossibile leggere i progressi: {error}"))?;
    if validate_payload(&payload).is_ok() {
        Ok(Some(payload))
    } else {
        Ok(None)
    }
}

fn save_to_root(storage_root: &Path, payload: &str) -> Result<(), String> {
    validate_payload(payload)?;
    fs::create_dir_all(storage_root)
        .map_err(|error| format!("Impossibile creare la cartella dei progressi: {error}"))?;

    let target = storage_root.join(PROGRESS_FILE);
    let backup = storage_root.join(PROGRESS_BACKUP_FILE);
    let temporary = storage_root.join(PROGRESS_TEMP_FILE);

    let mut file = File::create(&temporary)
        .map_err(|error| format!("Impossibile preparare il salvataggio: {error}"))?;
    file.write_all(payload.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Impossibile completare il salvataggio: {error}"))?;

    if target.is_file() {
        fs::copy(&target, &backup)
            .map_err(|error| format!("Impossibile creare il backup dei progressi: {error}"))?;
        fs::remove_file(&target)
            .map_err(|error| format!("Impossibile sostituire i progressi: {error}"))?;
    }

    if let Err(error) = fs::rename(&temporary, &target) {
        if backup.is_file() {
            let _ = fs::copy(&backup, &target);
        }
        return Err(format!(
            "Impossibile attivare il nuovo salvataggio: {error}"
        ));
    }

    if backup.is_file() {
        let _ = fs::remove_file(backup);
    }
    Ok(())
}

fn validate_payload(payload: &str) -> Result<Value, String> {
    if payload.len() > MAX_PROGRESS_BYTES {
        return Err("Il salvataggio supera il limite consentito".to_string());
    }

    let value: Value = serde_json::from_str(payload)
        .map_err(|error| format!("Formato progressi non valido: {error}"))?;
    if is_saved_course(&value) {
        Ok(value)
    } else {
        Err("Struttura progressi non valida".to_string())
    }
}

fn is_saved_course(value: &Value) -> bool {
    let Some(root) = value.as_object() else {
        return false;
    };
    let Some(active_lesson) = root.get("activeLesson").and_then(Value::as_str) else {
        return false;
    };
    if !valid_lesson_number(active_lesson) {
        return false;
    }
    let Some(lessons) = root.get("lessons").and_then(Value::as_object) else {
        return false;
    };
    if lessons.len() > 52 {
        return false;
    }

    lessons
        .iter()
        .all(|(number, progress)| valid_lesson_number(number) && is_lesson_progress(progress))
}

fn valid_lesson_number(value: &str) -> bool {
    value.len() == 2
        && value.bytes().all(|character| character.is_ascii_digit())
        && value
            .parse::<u8>()
            .is_ok_and(|number| (1..=52).contains(&number))
}

fn is_lesson_progress(value: &Value) -> bool {
    let Some(progress) = value.as_object() else {
        return false;
    };
    let valid_tab = progress
        .get("tab")
        .and_then(Value::as_str)
        .is_some_and(|tab| matches!(tab, "theory" | "quiz" | "lab"));
    let valid_slide = progress
        .get("slide")
        .and_then(Value::as_u64)
        .is_some_and(|slide| slide <= 1000);
    let valid_answers = progress
        .get("answers")
        .and_then(Value::as_object)
        .is_some_and(|answers| {
            answers.len() <= 200
                && answers
                    .values()
                    .all(|answer| answer.as_str().is_some_and(|text| text.len() <= 10_000))
        });
    let valid_quiz = progress
        .get("quizChecked")
        .and_then(Value::as_bool)
        .is_some();
    let valid_checks = progress
        .get("labChecks")
        .and_then(Value::as_array)
        .is_some_and(|checks| checks.len() <= 100 && checks.iter().all(Value::is_boolean));
    let valid_notes = progress
        .get("notes")
        .and_then(Value::as_str)
        .is_some_and(|notes| notes.len() <= 100_000);
    let valid_completed = progress.get("completed").and_then(Value::as_bool).is_some();
    let valid_code = progress
        .get("code")
        .and_then(Value::as_str)
        .is_some_and(|code| code.len() <= 500_000);

    valid_tab
        && valid_slide
        && valid_answers
        && valid_quiz
        && valid_checks
        && valid_notes
        && valid_completed
        && valid_code
}

fn recover_legacy_directory(directory: &Path) -> Result<Option<String>, String> {
    if !directory.is_dir() {
        return Ok(None);
    }

    let mut best: Option<(u64, Value)> = None;
    let entries = fs::read_dir(directory)
        .map_err(|error| format!("Impossibile cercare i progressi precedenti: {error}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let extension = path.extension().and_then(|value| value.to_str());
        if !matches!(extension, Some("log" | "ldb")) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.len() > MAX_LEGACY_FILE_BYTES {
            continue;
        }
        let Ok(bytes) = fs::read(path) else {
            continue;
        };

        for candidate in recover_legacy_bytes(&bytes) {
            let score = progress_score(&candidate);
            if best.as_ref().is_none_or(|(current, _)| score >= *current) {
                best = Some((score, candidate));
            }
        }
    }

    best.map(|(_, value)| {
        serde_json::to_string(&value)
            .map_err(|error| format!("Impossibile convertire i progressi recuperati: {error}"))
    })
    .transpose()
}

fn recover_legacy_bytes(bytes: &[u8]) -> Vec<Value> {
    let mut recovered = Vec::new();

    for key in LEGACY_KEYS {
        let mut cursor = 0;
        while let Some(relative) = find_bytes(&bytes[cursor..], key) {
            let key_end = cursor + relative + key.len();
            if let Some(value) = json_after(bytes, key_end).and_then(normalize_legacy_value) {
                recovered.push(value);
            }
            cursor = key_end;
        }
    }

    recovered
}

fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn json_after(bytes: &[u8], key_end: usize) -> Option<Value> {
    let search_end = bytes.len().min(key_end.saturating_add(64));
    let json_start = bytes[key_end..search_end]
        .iter()
        .position(|byte| *byte == b'{')?
        + key_end;

    let mut depth = 0_u32;
    let mut in_string = false;
    let mut escaped = false;

    for (relative, byte) in bytes[json_start..].iter().copied().enumerate() {
        if in_string {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                in_string = false;
            }
            continue;
        }

        match byte {
            b'"' => in_string = true,
            b'{' => depth += 1,
            b'}' => {
                depth = depth.checked_sub(1)?;
                if depth == 0 {
                    let json_end = json_start + relative + 1;
                    return serde_json::from_slice(&bytes[json_start..json_end]).ok();
                }
            }
            _ => {}
        }
    }

    None
}

fn normalize_legacy_value(value: Value) -> Option<Value> {
    if is_saved_course(&value) {
        return Some(value);
    }
    if is_lesson_progress(&value) {
        return Some(json!({
            "activeLesson": "01",
            "lessons": { "01": value }
        }));
    }
    None
}

fn progress_score(value: &Value) -> u64 {
    let active_lesson = value
        .get("activeLesson")
        .and_then(Value::as_str)
        .and_then(|number| number.parse::<u64>().ok())
        .unwrap_or(1);
    let Some(lessons) = value.get("lessons").and_then(Value::as_object) else {
        return 0;
    };

    let lesson_score = lessons.values().fold(0_u64, |score, progress| {
        let slide = progress.get("slide").and_then(Value::as_u64).unwrap_or(0);
        let answers = progress
            .get("answers")
            .and_then(Value::as_object)
            .map_or(0, |values| values.len() as u64);
        let checked = if progress
            .get("quizChecked")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            1
        } else {
            0
        };
        let lab_checks = progress
            .get("labChecks")
            .and_then(Value::as_array)
            .map_or(0, |checks| {
                checks
                    .iter()
                    .filter(|value| value.as_bool() == Some(true))
                    .count() as u64
            });
        let completed = if progress
            .get("completed")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            1
        } else {
            0
        };

        score + completed * 100_000 + slide * 1_000 + answers * 100 + checked * 50 + lab_checks * 20
    });

    active_lesson * 1_000_000 + lessons.len() as u64 * 10_000 + lesson_score
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lesson(slide: u64) -> Value {
        json!({
            "tab": "theory",
            "slide": slide,
            "answers": {},
            "quizChecked": false,
            "labChecks": [false, false, false],
            "notes": "",
            "completed": false,
            "code": "public class Main {}"
        })
    }

    fn encoded_record(key: &[u8], value: &Value) -> Vec<u8> {
        let mut record = b"leveldb-prefix".to_vec();
        record.extend_from_slice(key);
        record.extend_from_slice(&[0xe7, 0x04, 0x01]);
        record.extend_from_slice(serde_json::to_string(value).unwrap().as_bytes());
        record.extend_from_slice(b"leveldb-suffix");
        record
    }

    #[test]
    fn recovers_the_most_advanced_legacy_record() {
        let initial = json!({"activeLesson": "01", "lessons": {"01": lesson(0)}});
        let expected = json!({"activeLesson": "01", "lessons": {"01": lesson(3)}});
        let mut bytes = encoded_record(LEGACY_KEYS[0], &initial);
        bytes.extend_from_slice(&encoded_record(LEGACY_KEYS[0], &expected));
        bytes.extend_from_slice(&encoded_record(LEGACY_KEYS[0], &initial));

        let recovered = recover_legacy_bytes(&bytes);
        let best = recovered
            .into_iter()
            .max_by_key(progress_score)
            .expect("record recuperato");
        assert_eq!(best, expected);
    }

    #[test]
    fn wraps_the_previous_single_lesson_format() {
        let previous = lesson(2);
        let bytes = encoded_record(LEGACY_KEYS[1], &previous);
        let recovered = recover_legacy_bytes(&bytes);

        assert_eq!(recovered.len(), 1);
        assert_eq!(recovered[0]["activeLesson"], "01");
        assert_eq!(recovered[0]["lessons"]["01"]["slide"], 2);
    }

    #[test]
    fn rejects_an_invalid_saved_course() {
        let invalid = json!({"activeLesson": "../../", "lessons": {}}).to_string();
        assert!(validate_payload(&invalid).is_err());
    }
}
