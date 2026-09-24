import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CURRENT_RELEASE_NOTES,
  shouldShowReleaseNotes,
} from '../app/release-notes.ts';
import { APP_VERSION } from '../app/version.ts';

test('le note pubblicate corrispondono alla versione dell\u2019app', () => {
  assert.equal(CURRENT_RELEASE_NOTES.version, APP_VERSION);
  assert.ok(CURRENT_RELEASE_NOTES.features.length >= 1);
});

test('mostra il riepilogo soltanto finch\u00e9 la versione non \u00e8 stata letta', () => {
  assert.equal(shouldShowReleaseNotes(APP_VERSION), true);
  assert.equal(shouldShowReleaseNotes(APP_VERSION, '0.6.8'), true);
  assert.equal(shouldShowReleaseNotes(APP_VERSION, APP_VERSION), false);
});
