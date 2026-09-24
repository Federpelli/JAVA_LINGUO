'use client';

import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Code2,
  Container,
  GitBranch as Github,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Progress, ProgressLabel } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { courseManifest, loadLesson } from './course-loader';
import {
  firstIncompleteLesson,
  lessonAccessStatus,
} from './course-progression';
import type { CourseLesson } from './course-types';
import {
  isTauriRuntime,
  loadNativeCourseProgress,
  saveNativeCourseProgress,
} from './progress-persistence';
import UpdateCenter from './update-center';
import { APP_VERSION } from './version';
import WhatsNewDialog from './whats-new-dialog';
import { shouldShowReleaseNotes } from './release-notes';

type Answers = Record<string, string>;
type SandboxStatus = {
  available: boolean;
  message: string;
  image: string;
  commands: string[];
};
type CommandResult = {
  ok?: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  durationMs?: number;
};
type TerminalEntry = {
  id: number;
  command: string;
  output: string;
  ok: boolean;
  meta?: string;
};

type LessonProgress = {
  tab: string;
  slide: number;
  answers: Answers;
  quizChecked: boolean;
  labChecks: boolean[];
  notes: string;
  completed: boolean;
  code: string;
};

type SavedCourse = {
  activeLesson: string;
  lessons: Record<string, LessonProgress>;
  lastSeenVersion?: string;
};

const STORAGE_KEY = 'java-linguo-progress-v3';
const PREVIOUS_STORAGE_KEY = 'java-linguo-progress-v2';
const LEGACY_STORAGE_KEY = 'studio-java-progress-v2';
const DEFAULT_GITHUB_URL = 'https://github.com/Federpelli/JAVA_LINGUO';
const EMPTY_ANSWERS: Answers = {};
const JavaCodeEditor = dynamic(() => import('./java-code-editor'), {
  ssr: false,
  loading: () => (
    <output className="editor-loading">Caricamento editor Java…</output>
  ),
});

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10_000,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function initialProgress(lesson: CourseLesson): LessonProgress {
  return {
    tab: 'theory',
    slide: 0,
    answers: {},
    quizChecked: false,
    labChecks: lesson.lab.map(() => false),
    notes: '',
    completed: false,
    code: lesson.starterCode,
  };
}

function inlineCode(text: string) {
  return text
    .split(/(`[^`]+`)/g)
    .map((part, index) =>
      part.startsWith('`') && part.endsWith('`') ? (
        <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>
      ) : (
        part
      ),
    );
}

export default function Home() {
  const [activeNumber, setActiveNumber] = useState('01');
  const [loadedLesson, setLoadedLesson] = useState<CourseLesson | null>(null);
  const [lessonError, setLessonError] = useState('');
  const [progressByLesson, setProgressByLesson] = useState<
    Record<string, LessonProgress>
  >({});
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [command, setCommand] = useState('java Main.java');
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [configReady, setConfigReady] = useState(false);
  const [sandboxChecked, setSandboxChecked] = useState(false);
  const [sandboxChecking, setSandboxChecking] = useState(false);
  const [persistenceWarning, setPersistenceWarning] = useState('');
  const [lessonReloadKey, setLessonReloadKey] = useState(0);
  const [lastSeenVersion, setLastSeenVersion] = useState('');
  const sandboxCheckInFlight = useRef(false);
  const lessonCardRef = useRef<HTMLElement>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);
  const [githubUrl, setGithubUrl] = useState(DEFAULT_GITHUB_URL);
  const [sandbox, setSandbox] = useState<SandboxStatus>({
    available: false,
    message: 'La sandbox verrà verificata quando apri il laboratorio.',
    image: 'eclipse-temurin:25-jdk',
    commands: ['java --version', 'javac Main.java', 'java Main.java'],
  });

  const refreshSandbox = useCallback(async () => {
    if (sandboxCheckInFlight.current) return;
    sandboxCheckInFlight.current = true;
    setSandboxChecking(true);
    try {
      const response = await fetchWithTimeout(
        '/api/lab/status',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: '{}',
        },
        10_000,
      );
      if (!response.ok) throw new Error('Stato sandbox non disponibile');
      setSandbox((await response.json()) as SandboxStatus);
    } catch {
      setSandbox((current) => ({
        ...current,
        available: false,
        message:
          'Docker non risponde. Avvia Docker Desktop e riapri JAVA_linguo.',
      }));
    } finally {
      sandboxCheckInFlight.current = false;
      setSandboxChecking(false);
      setSandboxChecked(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateProgress() {
      let nativeRaw: string | null = null;
      let nativeLoadError: unknown = null;

      try {
        nativeRaw = await loadNativeCourseProgress();
      } catch (error) {
        nativeLoadError = error;
        console.error('[progress:native-load]', error);
      }

      if (cancelled) return;

      try {
        const raw = nativeRaw ?? window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as SavedCourse;
          if (saved.activeLesson) setActiveNumber(saved.activeLesson);
          setProgressByLesson(saved.lessons ?? {});
          setLastSeenVersion(saved.lastSeenVersion ?? '');
        } else {
          const previousRaw =
            window.localStorage.getItem(PREVIOUS_STORAGE_KEY) ??
            window.localStorage.getItem(LEGACY_STORAGE_KEY);
          if (previousRaw) {
            const previous = JSON.parse(previousRaw) as Partial<LessonProgress>;
            setProgressByLesson({
              '01': {
                tab: previous.tab ?? 'theory',
                slide: previous.slide ?? 0,
                answers: previous.answers ?? {},
                quizChecked: previous.quizChecked ?? false,
                labChecks: previous.labChecks ?? [false, false, false],
                notes: previous.notes ?? '',
                completed: previous.completed ?? false,
                code: previous.code ?? '',
              },
            });
          }
        }
        if (nativeLoadError) {
          setPersistenceWarning(
            'L’archivio permanente non è disponibile. I progressi restano salvati localmente per questa sessione.',
          );
        }
      } catch (error) {
        console.error('[progress:load]', error);
        setPersistenceWarning(
          'I progressi salvati non sono leggibili. Puoi continuare, ma questa sessione potrebbe non essere conservata.',
        );
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void hydrateProgress();

    fetchWithTimeout('/app-config.json', {}, 10_000)
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Configurazione locale non disponibile');
        return response.json();
      })
      .then((value) => {
        const config = value as {
          githubRepositoryUrl?: string;
          labSandbox?: SandboxStatus;
        };
        setGithubUrl(config.githubRepositoryUrl || DEFAULT_GITHUB_URL);
        if (config.labSandbox) setSandbox(config.labSandbox);
      })
      .catch(() =>
        setSandbox({
          available: false,
          message:
            'Apri l’app con avvia.py per usare il terminale Docker locale.',
          image: 'eclipse-temurin:25-jdk',
          commands: ['java --version', 'javac Main.java', 'java Main.java'],
        }),
      )
      .finally(() => setConfigReady(true));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLesson(activeNumber)
      .then((loaded) => {
        if (cancelled) return;
        setLessonError('');
        setLoadedLesson(loaded);
        setProgressByLesson((current) => {
          const saved = current[loaded.number];
          const defaults = initialProgress(loaded);
          return {
            ...current,
            [loaded.number]: saved
              ? {
                  ...defaults,
                  ...saved,
                  slide: Math.min(
                    Math.max(0, saved.slide ?? 0),
                    loaded.theory.length - 1,
                  ),
                  labChecks: loaded.lab.map(
                    (_, index) => saved.labChecks?.[index] ?? false,
                  ),
                  code: saved.code || loaded.starterCode,
                }
              : defaults,
          };
        });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLessonError(
            error instanceof Error ? error.message : 'Lezione non disponibile.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [activeNumber, lessonReloadKey]);

  useEffect(() => {
    if (!hydrated) return;

    const payload = JSON.stringify({
      activeLesson: activeNumber,
      lessons: progressByLesson,
      lastSeenVersion,
    } satisfies SavedCourse);
    const nativeRequired = isTauriRuntime();

    const persistProgress = async () => {
      let localSaved = false;
      let nativeSaved = false;

      try {
        window.localStorage.setItem(STORAGE_KEY, payload);
        window.localStorage.removeItem(PREVIOUS_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        localSaved = true;
      } catch (error) {
        console.error('[progress:local-save]', error);
      }

      try {
        nativeSaved = await saveNativeCourseProgress(payload);
      } catch (error) {
        console.error('[progress:native-save]', error);
      }

      if (
        (nativeRequired && !nativeSaved) ||
        (!nativeRequired && !localSaved)
      ) {
        setPersistenceWarning(
          'I progressi non possono essere salvati sul dispositivo. Verifica lo spazio disponibile e le impostazioni dell’app.',
        );
      } else {
        setPersistenceWarning('');
      }
    };
    const persistWithoutWaiting = () => {
      void persistProgress();
    };
    const timeout = window.setTimeout(persistWithoutWaiting, 120);
    window.addEventListener('pagehide', persistWithoutWaiting, { once: true });

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('pagehide', persistWithoutWaiting);
    };
  }, [activeNumber, progressByLesson, hydrated, lastSeenVersion]);

  useEffect(() => {
    if (!hydrated) return;
    const activeIndex = courseManifest.findIndex(
      (item) => item.number === activeNumber,
    );
    if (
      lessonAccessStatus(courseManifest, activeIndex, progressByLesson) !==
      'locked'
    )
      return;
    const fallback =
      firstIncompleteLesson(courseManifest, progressByLesson) ??
      courseManifest[0];
    queueMicrotask(() => setActiveNumber(fallback.number));
  }, [activeNumber, progressByLesson, hydrated]);

  const lesson = loadedLesson?.number === activeNumber ? loadedLesson : null;
  const lessonProgress = lesson ? progressByLesson[lesson.number] : undefined;
  const answers = lessonProgress?.answers ?? EMPTY_ANSWERS;
  const slide = lessonProgress?.slide ?? 0;
  const labChecks = lessonProgress?.labChecks ?? [];
  const quizChecked = lessonProgress?.quizChecked ?? false;
  const completed = lessonProgress?.completed ?? false;
  const tab = lessonProgress?.tab ?? 'theory';
  const code = lessonProgress?.code ?? '';
  const notes = lessonProgress?.notes ?? '';

  useEffect(() => {
    if (configReady && tab === 'lab' && !sandboxChecked && !sandboxChecking) {
      queueMicrotask(() => void refreshSandbox());
    }
  }, [configReady, refreshSandbox, sandboxChecked, sandboxChecking, tab]);

  const quizScore = useMemo(
    () =>
      lesson?.quiz.filter(
        (question) => answers[question.id] === question.correct,
      ).length ?? 0,
    [answers, lesson],
  );
  const quizPassed = Boolean(
    lesson && quizChecked && quizScore === lesson.quiz.length,
  );
  const progress = completed
    ? 100
    : Math.min(
        99,
        Math.round(
          lesson
            ? ((slide + 1) / lesson.theory.length) * 35 +
                (quizPassed
                  ? 30
                  : quizChecked
                    ? (quizScore / lesson.quiz.length) * 30
                    : 0) +
                (labChecks.length
                  ? (labChecks.filter(Boolean).length / labChecks.length) * 35
                  : 0)
            : 0,
        ),
      );
  const section = lesson?.theory[slide];

  function updateProgress(
    update:
      | Partial<LessonProgress>
      | ((current: LessonProgress) => Partial<LessonProgress>),
  ) {
    if (!lesson) return;
    setProgressByLesson((current) => {
      const saved = current[lesson.number] ?? initialProgress(lesson);
      const patch = typeof update === 'function' ? update(saved) : update;
      return {
        ...current,
        [lesson.number]: { ...saved, ...patch },
      };
    });
  }

  function selectSlide(nextSlide: number | ((currentSlide: number) => number)) {
    if (!lesson) return;

    setProgressByLesson((current) => {
      const saved = current[lesson.number] ?? initialProgress(lesson);
      const requested =
        typeof nextSlide === 'function'
          ? nextSlide(saved.slide ?? 0)
          : nextSlide;
      const bounded = Math.min(
        Math.max(0, requested),
        lesson.theory.length - 1,
      );

      return {
        ...current,
        [lesson.number]: { ...saved, slide: bounded },
      };
    });

    window.requestAnimationFrame(() => {
      lessonCardRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      });
      lessonHeadingRef.current?.focus({ preventScroll: true });
    });
  }

  function setTab(value: string) {
    updateProgress({ tab: value });
  }

  function openLesson(number: string) {
    const targetIndex = courseManifest.findIndex(
      (item) => item.number === number,
    );
    if (
      lessonAccessStatus(courseManifest, targetIndex, progressByLesson) ===
      'locked'
    )
      return;
    setLessonError('');
    setActiveNumber(number);
    setTerminalEntries([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetProgress() {
    if (!lesson) return;
    setProgressByLesson((current) => ({
      ...current,
      [lesson.number]: initialProgress(lesson),
    }));
    setTerminalEntries([]);
  }

  function appendTerminal(entry: Omit<TerminalEntry, 'id'>) {
    setTerminalEntries((current) => [
      ...current,
      { ...entry, id: Date.now() + current.length },
    ]);
  }

  async function runCommand(requestedCommand = command) {
    const normalized = requestedCommand.trim().replace(/\s+/g, ' ');
    setCommand(normalized);
    if (normalized === 'clear') {
      setTerminalEntries([]);
      return;
    }
    if (normalized === 'help') {
      appendTerminal({
        command: 'help',
        output: `Comandi disponibili:\n${sandbox.commands.join('\n')}\nclear`,
        ok: true,
      });
      return;
    }
    if (!sandbox.available) {
      appendTerminal({
        command: normalized,
        output: sandbox.message,
        ok: false,
      });
      return;
    }
    setRunning(true);
    try {
      const response = await fetchWithTimeout(
        '/api/lab/command',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            code: lessonProgress?.code ?? '',
            command: normalized,
          }),
        },
        25_000,
      );
      const result = (await response.json()) as CommandResult;
      appendTerminal({
        command: normalized,
        output: result.output ?? result.error ?? 'Nessun output ricevuto.',
        ok: response.ok && result.ok === true,
        meta:
          result.durationMs !== undefined
            ? `${result.durationMs} ms · exit ${result.exitCode ?? '—'}`
            : undefined,
      });
    } catch {
      appendTerminal({
        command: normalized,
        output: 'Il servizio locale non risponde. Riavvia avvia.py e riprova.',
        ok: false,
      });
    } finally {
      setRunning(false);
    }
  }

  function editorShortcut(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      void runCommand('java Main.java');
    }
  }

  if (!lesson || !lessonProgress || !section) {
    return (
      <main className="lesson-loading-screen">
        <Image
          src="/favicon.svg"
          alt="JAVA_linguo"
          width={56}
          height={56}
          unoptimized
        />
        {lessonError ? (
          <>
            <strong>Impossibile aprire la lezione</strong>
            <p>{lessonError}</p>
            <Button
              onClick={() => {
                setLessonError('');
                setActiveNumber('01');
                setLessonReloadKey((value) => value + 1);
              }}
            >
              Riprova dalla lezione 01
            </Button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" />
            <strong>Preparazione lezione {activeNumber}…</strong>
          </>
        )}
      </main>
    );
  }

  const activeLessonIndex = courseManifest.findIndex(
    (item) => item.number === lesson.number,
  );
  const nextLesson = courseManifest[activeLessonIndex + 1];
  const firstIncompleteIndex = courseManifest.findIndex(
    (item) => progressByLesson[item.number]?.completed !== true,
  );
  const showReleaseNotes =
    hydrated && shouldShowReleaseNotes(APP_VERSION, lastSeenVersion);

  return (
    <>
      <WhatsNewDialog
        open={showReleaseNotes}
        onDismiss={() => setLastSeenVersion(APP_VERSION)}
      />
      <main className="app-shell">
      <aside className="course-rail">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Image
              src="/favicon.svg"
              alt=""
              width={45}
              height={45}
              unoptimized
            />
          </span>
          <div>
            <strong>JAVA_linguo</strong>
            <span>Corso pratico su GitHub</span>
          </div>
        </div>
        <div className="rail-label">Percorso accademico</div>
        <nav aria-label="Lezioni del corso" className="lesson-list">
          {courseManifest.map((item, itemIndex) => {
            const access = lessonAccessStatus(
              courseManifest,
              itemIndex,
              progressByLesson,
            );
            const itemCompleted = access === 'completed';
            const active = item.number === lesson.number;
            const immediatelyNext =
              access === 'locked' && itemIndex === firstIncompleteIndex + 1;
            return (
              <button
                className={`lesson-row ${access} ${active ? 'active' : ''}`}
                disabled={access === 'locked'}
                onClick={() => openLesson(item.number)}
                key={item.number}
                aria-current={active ? 'page' : undefined}
              >
                <span className="lesson-number">{item.number}</span>
                <span className="lesson-copy">
                  <strong>{item.title}</strong>
                  <small>
                    {itemCompleted
                      ? 'Completata'
                      : access === 'current'
                        ? active
                          ? 'In corso'
                          : 'Disponibile'
                        : immediatelyNext
                          ? `Completa prima la lezione ${courseManifest[itemIndex - 1].number}`
                          : 'Bloccata'}
                  </small>
                </span>
                {itemCompleted ? (
                  <CheckCircle2 />
                ) : access === 'locked' ? (
                  <LockKeyhole />
                ) : (
                  <ChevronRight />
                )}
              </button>
            );
          })}
        </nav>
        <div className="release-note">
          <CalendarClock />
          <div>
            <strong>Nuovo materiale</strong>
            <span>Ogni due settimane</span>
          </div>
        </div>
        <div className="rail-footer">
          <div>
            <span className="status-dot" />
            Java 25 LTS
          </div>
          <div>
            <span className="version-dot">v</span>Versione {APP_VERSION}
          </div>
          <a href={githubUrl} target="_blank" rel="noreferrer">
            <Github /> GitHub
          </a>
        </div>
      </aside>

      <section className="workspace">
        <Tabs value={tab} onValueChange={setTab} className="lesson-tabs">
          <header className="topbar">
            <div className="lesson-identity">
              <div className="breadcrumb">
                {lesson.area} <ChevronRight /> Lezione {lesson.number}
              </div>
              <h1>{lesson.title}</h1>
              <label className="lesson-picker-label" htmlFor="lesson-picker">
                <span>Scegli lezione</span>
                <select
                  id="lesson-picker"
                  value={lesson.number}
                  onChange={(event) => openLesson(event.target.value)}
                >
                  {courseManifest.map((item, index) => {
                    const locked =
                      lessonAccessStatus(
                        courseManifest,
                        index,
                        progressByLesson,
                      ) === 'locked';
                    return (
                      <option
                        value={item.number}
                        disabled={locked}
                        key={item.number}
                      >
                        {item.number} · {item.title}
                        {locked ? ' — bloccata' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <TabsList className="header-tabs" aria-label="Fasi della lezione">
              <TabsTrigger value="theory">
                <BookOpen /> <span>Teoria</span>
              </TabsTrigger>
              <TabsTrigger value="quiz">
                <CircleDot /> <span>Verifica</span>
                {quizPassed && <Check className="tab-check" />}
              </TabsTrigger>
              <TabsTrigger value="lab">
                <Code2 /> <span>Laboratorio</span>
              </TabsTrigger>
            </TabsList>
            <div className="top-actions">
              <Progress value={progress} className="course-progress">
                <ProgressLabel>Progresso</ProgressLabel>
                <span className="progress-value">{progress}%</span>
              </Progress>
              <UpdateCenter
                currentVersion={APP_VERSION}
                autoCheckEnabled={!showReleaseNotes}
              />
              <AlertDialog
                open={resetDialogOpen}
                onOpenChange={setResetDialogOpen}
              >
                <AlertDialogTrigger
                  render={<Button variant="ghost" size="icon" />}
                  aria-label="Azzera progressi"
                >
                  <RotateCcw />
                </AlertDialogTrigger>
                <AlertDialogContent className="reset-dialog">
                  <AlertDialogHeader>
                    <AlertDialogMedia className="reset-dialog-icon">
                      <RotateCcw />
                    </AlertDialogMedia>
                    <AlertDialogTitle>
                      Azzerare questa lezione?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Verranno cancellati progressi, risposte, appunti e codice
                      salvati per la lezione {lesson.number}. L’operazione non
                      può essere annullata.
                      {nextLesson &&
                        ' Se azzeri una lezione completata, le lezioni successive torneranno bloccate finché non la completerai di nuovo.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Continua a studiare</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => {
                        resetProgress();
                        setResetDialogOpen(false);
                      }}
                    >
                      Azzera progressi
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </header>

          {persistenceWarning && (
            <div className="persistence-warning" role="alert">
              <Lightbulb />
              {persistenceWarning}
            </div>
          )}

          <TabsContent value="theory" className="content-panel">
            <div className="theory-layout">
              <article
                className="lesson-card"
                ref={lessonCardRef}
                key={`${lesson.number}-${slide}`}
              >
                <div className="card-meta">
                  <span>{section.kicker}</span>
                  <span>
                    {slide + 1} / {lesson.theory.length}
                  </span>
                </div>
                <h2 ref={lessonHeadingRef} tabIndex={-1}>
                  {inlineCode(section.title)}
                </h2>
                <p className="lead">{section.lead}</p>
                <div className="plain-language">
                  <span>In parole semplici</span>
                  <p>{inlineCode(section.plain)}</p>
                </div>
                {section.analogy && (
                  <div className="analogy">
                    <span>Un’analogia utile</span>
                    <p>{inlineCode(section.analogy)}</p>
                  </div>
                )}
                <ul className="concept-list">
                  {section.points.map((point) => (
                    <li key={point}>
                      <span className="concept-bullet" />
                      <span>{inlineCode(point)}</span>
                    </li>
                  ))}
                </ul>
                {section.code && (
                  <pre className="code-window">
                    <span>JAVA</span>
                    <code>{section.code}</code>
                  </pre>
                )}
                {section.walkthrough && (
                  <div className="walkthrough">
                    <span>Passo per passo</span>
                    <ol>
                      {section.walkthrough.map((step) => (
                        <li key={step}>{inlineCode(step)}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <div className="callout">
                  <Lightbulb />
                  <p>{inlineCode(section.callout)}</p>
                </div>
                <div className="lesson-controls">
                  <Button
                    variant="outline"
                    onClick={() => selectSlide((current) => current - 1)}
                    disabled={slide === 0}
                  >
                    <ArrowLeft /> Indietro
                  </Button>
                  {slide < lesson.theory.length - 1 ? (
                    <Button
                      onClick={() => selectSlide((current) => current + 1)}
                    >
                      Continua <ArrowRight />
                    </Button>
                  ) : (
                    <Button onClick={() => setTab('quiz')}>
                      Vai alla verifica <ArrowRight />
                    </Button>
                  )}
                </div>
              </article>
              <aside className="study-aside">
                <div className="session-card">
                  <GraduationCap />
                  <div>
                    <span>
                      {lesson.level} · JDK {lesson.minimumJdk}+
                    </span>
                    <strong>{lesson.duration}</strong>
                  </div>
                </div>
                <div className="aside-card lesson-outcome">
                  <b>Risultato atteso</b>
                  <p>{lesson.outcome}</p>
                  <small>
                    Prerequisiti: {lesson.prerequisites.join(' · ')}
                  </small>
                </div>
                <div className="aside-card question-card">
                  <b>Prima di proseguire</b>
                  <p>{inlineCode(section.question)}</p>
                  <small>Rispondi a voce senza rileggere.</small>
                </div>
                <div className="slide-map">
                  {lesson.theory.map((item, index) => (
                    <button
                      key={item.title}
                      className={
                        index === slide
                          ? 'current'
                          : index < slide
                            ? 'visited'
                            : ''
                      }
                      onClick={() => selectSlide(index)}
                      aria-label={`Scheda ${index + 1}`}
                    >
                      <span>{index < slide ? <Check /> : index + 1}</span>
                      <small>{item.kicker}</small>
                    </button>
                  ))}
                </div>
                <div className="aside-card lesson-sources">
                  <b>Fonti ufficiali</b>
                  {lesson.sources.map((source) => (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      key={source.url}
                    >
                      {source.label}
                    </a>
                  ))}
                </div>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="quiz" className="content-panel">
            <div className="section-heading">
              <span>Checkpoint</span>
              <h2>Verifica ciò che hai capito</h2>
              <p>
                Rispondi senza tornare alla teoria. Puoi riprovare tutte le
                volte che vuoi.
              </p>
            </div>
            <div className="quiz-grid">
              {lesson.quiz.map((question, index) => {
                const correct = answers[question.id] === question.correct;
                return (
                  <article
                    className={`quiz-card ${quizChecked ? (correct ? 'correct' : 'incorrect') : ''}`}
                    key={question.id}
                  >
                    <div className="question-number">0{index + 1}</div>
                    <h3>{question.question}</h3>
                    <RadioGroup
                      value={answers[question.id] ?? ''}
                      onValueChange={(value) =>
                        updateProgress((current) => ({
                          answers: {
                            ...current.answers,
                            [question.id]: String(value),
                          },
                          quizChecked: false,
                        }))
                      }
                      aria-label={question.question}
                    >
                      {question.options.map((option) => (
                        <label className="option-row" key={option.id}>
                          <RadioGroupItem value={option.id} />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {quizChecked && (
                      <p className="answer-feedback">
                        {correct ? <CheckCircle2 /> : <Lightbulb />}
                        {question.explanation}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
            <div className="quiz-actions">
              {quizChecked && (
                <div className={`score ${quizPassed ? 'passed' : ''}`}>
                  {quizScore}/{lesson.quiz.length} corrette
                </div>
              )}
              <Button
                variant={quizPassed ? 'outline' : 'default'}
                disabled={Object.keys(answers).length !== lesson.quiz.length}
                onClick={() => updateProgress({ quizChecked: true })}
              >
                Controlla risposte
              </Button>
              {quizPassed && (
                <Button onClick={() => setTab('lab')}>
                  Apri il laboratorio <ArrowRight />
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lab" className="content-panel lab-panel">
            <div className="lab-heading">
              <div className="section-heading">
                <span>Scrivi, compila, osserva</span>
                <h2>Laboratorio interattivo</h2>
                <p>
                  Modifica <code>Main.java</code>, prevedi il risultato e
                  verifica la tua ipotesi nel container isolato.
                </p>
              </div>
              <div
                className={`sandbox-badge ${sandboxChecking ? 'checking' : sandbox.available ? 'ready' : 'offline'}`}
              >
                {sandboxChecking ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <ShieldCheck />
                )}
                <div>
                  <span>Sandbox Docker</span>
                  <strong>
                    {sandboxChecking
                      ? 'Verifica…'
                      : sandbox.available
                        ? 'Pronta'
                        : 'Da configurare'}
                  </strong>
                </div>
              </div>
            </div>
            {!quizPassed && (
              <div className="warning-banner">
                <Lightbulb /> Ti consiglio di superare prima la verifica.
                <Button variant="link" onClick={() => setTab('quiz')}>
                  Vai alla verifica
                </Button>
              </div>
            )}

            <section
              className="lab-briefing"
              aria-labelledby="lab-briefing-title"
            >
              <div className="lab-briefing-copy">
                <span>Metodo di lavoro</span>
                <h3 id="lab-briefing-title">
                  Dalla consegna a una soluzione verificabile
                </h3>
                <p>
                  Nel file iniziale trovi lo scheletro del metodo richiesto.
                  Prima traduci la consegna in input, output e casi limite; poi
                  completa il TODO e modifica il <code>main</code> con prove
                  piccole. La missione è conclusa solo quando sai spiegare
                  perché la soluzione rispetta il contratto.
                </p>
              </div>
              <ol className="lab-workflow">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Prevedi</strong>
                    <small>
                      Scrivi su carta il risultato di almeno un esempio.
                    </small>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Implementa</strong>
                    <small>
                      Digita il metodo a mano seguendo il contratto, senza
                      copiare una soluzione.
                    </small>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Verifica</strong>
                    <small>
                      Compila, esegui e prova casi normali, limite e non validi.
                    </small>
                  </div>
                </li>
                <li>
                  <span>4</span>
                  <div>
                    <strong>Spiega</strong>
                    <small>
                      Motiva la scelta richiesta nel diario prima di spuntare la
                      missione.
                    </small>
                  </div>
                </li>
              </ol>
            </section>

            <Accordion
              className="mission-grid"
              defaultValue={[lesson.lab[0]?.method]}
            >
              {lesson.lab.map((mission, index) => (
                <AccordionItem
                  className="mission-card"
                  value={mission.method}
                  key={mission.method}
                >
                  <AccordionTrigger className="mission-trigger">
                    <div className="mission-topline">
                      <span>{mission.title}</span>
                      <code>{mission.method}()</code>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="mission-content">
                    <p className="mission-scenario">{mission.scenario}</p>
                    <div className="mission-goal">
                      <span>Consegna</span>
                      <h3>{mission.goal}</h3>
                      <code>{mission.signature}</code>
                    </div>
                    <div className="mission-roadmap">
                      <h4>Procedura consigliata</h4>
                      <ol>
                        {mission.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="mission-columns">
                      <div>
                        <h4>Vincoli tecnici</h4>
                        <ul>
                          {mission.constraints.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4>Casi da verificare</h4>
                        <div className="example-list">
                          {mission.examples.map((example) => (
                            <div
                              className="example-row"
                              key={`${example.input}-${example.output}`}
                            >
                              <div>
                                <code>{example.input}</code>
                                <span aria-hidden="true">→</span>
                                <code>{example.output}</code>
                              </div>
                              <small>{example.purpose}</small>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mission-acceptance">
                      <h4>Quando la missione è completa</h4>
                      <ul>
                        {mission.acceptance.map((item) => (
                          <li key={item}>
                            <Check />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mission-prompts">
                      <div>
                        <span>Spiega la tua scelta</span>
                        <p>{mission.reflection}</p>
                      </div>
                      <div>
                        <span>Sfida facoltativa</span>
                        <p>{mission.challenge}</p>
                      </div>
                    </div>
                    <label
                      className="mission-check"
                      htmlFor={`mission-${lesson.number}-${index}`}
                    >
                      <Checkbox
                        id={`mission-${lesson.number}-${index}`}
                        checked={labChecks[index]}
                        onCheckedChange={(checked) =>
                          updateProgress((current) => ({
                            labChecks: current.labChecks.map(
                              (value, itemIndex) =>
                                itemIndex === index ? checked === true : value,
                            ),
                          }))
                        }
                      />
                      Ho implementato il metodo, verificato tutti i casi e
                      scritto la motivazione
                    </label>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="lab-studio">
              <section className="editor-card" aria-label="Editor Java">
                <div className="ide-toolbar">
                  <div className="file-tab">
                    <Code2 /> Main.java <span>{code.length} caratteri</span>
                  </div>
                  <div className="editor-actions">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        running || sandboxChecking || !sandbox.available
                      }
                      onClick={() => void runCommand('javac Main.java')}
                    >
                      Compila
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        running || sandboxChecking || !sandbox.available
                      }
                      onClick={() => void runCommand('java Main.java')}
                    >
                      {running ? <LoaderCircle className="spin" /> : <Play />}{' '}
                      Esegui
                    </Button>
                  </div>
                </div>
                <div
                  className="editor-surface"
                  onKeyDownCapture={editorShortcut}
                >
                  {tab === 'lab' && (
                    <JavaCodeEditor
                      value={code}
                      onChange={(value) => updateProgress({ code: value })}
                    />
                  )}
                </div>
                <div className="editor-footer">
                  <span>JDK {lesson.minimumJdk}+</span>
                  <span>Ctrl + Invio per eseguire</span>
                  <span>Salvataggio locale automatico</span>
                </div>
              </section>

              <section
                className="terminal-card"
                aria-label="Terminale Java limitato"
              >
                <div className="terminal-toolbar">
                  <div>
                    <TerminalSquare />
                    <strong>Terminale</strong>
                  </div>
                  <button type="button" onClick={() => setTerminalEntries([])}>
                    Pulisci
                  </button>
                </div>
                <div className="terminal-output" aria-live="polite">
                  <div className="terminal-welcome">
                    <Container />
                    <p>
                      <strong>Ambiente isolato</strong>
                      <span>{sandbox.message}</span>
                    </p>
                  </div>
                  {terminalEntries.map((entry) => (
                    <div className="terminal-entry" key={entry.id}>
                      <div className="terminal-command">
                        <span>$</span> {entry.command}
                      </div>
                      <pre className={entry.ok ? 'success' : 'error'}>
                        {entry.output}
                      </pre>
                      {entry.meta && <small>{entry.meta}</small>}
                    </div>
                  ))}
                  {running && (
                    <div className="terminal-running">
                      <LoaderCircle className="spin" /> Container in esecuzione…
                    </div>
                  )}
                </div>
                <form
                  className="terminal-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runCommand();
                  }}
                >
                  <label htmlFor="terminal-command">Scrivi un comando</label>
                  <div className="terminal-prompt">
                    <span aria-hidden="true">$</span>
                    <input
                      id="terminal-command"
                      value={command}
                      onChange={(event) => setCommand(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      aria-describedby="terminal-help"
                      placeholder="es. java Main.java"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={running || sandboxChecking}
                    >
                      Invio
                    </Button>
                  </div>
                  <small id="terminal-help" className="terminal-help">
                    Scrivi <code>help</code> per vedere i comandi consentiti.
                    Nessuna shell del PC viene esposta.
                  </small>
                </form>
              </section>
            </div>

            <div className="sandbox-explainer">
              <ShieldCheck />
              <div>
                <strong>
                  Il codice non viene eseguito direttamente sul computer
                </strong>
                <p>
                  Ogni comando usa un container temporaneo senza rete e con
                  utente non-root. Il sorgente è montato in sola lettura;
                  memoria, CPU, processi, spazio, output e tempo sono limitati.
                  Al termine l’ambiente viene eliminato.
                </p>
              </div>
            </div>
            <div className="lab-bottom">
              <div className="command-card">
                <span>Comando consigliato</span>
                <code>java Main.java</code>
                <small>
                  Compila ed esegue il file sorgente nel container temporaneo.
                </small>
              </div>
              <label className="notes-card" htmlFor="lab-notes">
                <span>Diario rapido</span>
                <textarea
                  id="lab-notes"
                  value={notes}
                  onChange={(event) =>
                    updateProgress({ notes: event.target.value })
                  }
                  placeholder="Errore, causa, cosa hai imparato…"
                />
              </label>
            </div>
            {labChecks.length > 0 &&
              labChecks.every(Boolean) &&
              !quizPassed &&
              !completed && (
                <div className="completion-card gated">
                  <LockKeyhole />
                  <div>
                    <span>Manca la verifica</span>
                    <h3>
                      Supera tutte le domande della verifica per poter
                      completare la lezione e sbloccare la successiva.
                    </h3>
                  </div>
                  <Button variant="outline" onClick={() => setTab('quiz')}>
                    Completa la verifica
                  </Button>
                </div>
              )}
            {labChecks.length > 0 &&
              labChecks.every(Boolean) &&
              (quizPassed || completed) && (
                <div className={`completion-card ${completed ? 'done' : ''}`}>
                  <CheckCircle2 />
                  <div>
                    <span>
                      {completed ? 'Lezione completata' : 'Ultimo checkpoint'}
                    </span>
                    <h3>
                      {completed
                        ? nextLesson
                          ? `La lezione ${nextLesson.number} è ora disponibile.`
                          : 'Hai completato l’intero percorso JAVA_linguo.'
                        : 'Verifica e laboratorio sono completi: conferma per sbloccare il passo successivo.'}
                    </h3>
                  </div>
                  {!completed ? (
                    <Button onClick={() => updateProgress({ completed: true })}>
                      {nextLesson
                        ? `Completa e sblocca la ${nextLesson.number}`
                        : 'Completa il corso'}
                    </Button>
                  ) : (
                    nextLesson && (
                      <Button onClick={() => openLesson(nextLesson.number)}>
                        Apri la lezione {nextLesson.number} <ArrowRight />
                      </Button>
                    )
                  )}
                </div>
              )}
          </TabsContent>
        </Tabs>
      </section>
      </main>
    </>
  );
}
