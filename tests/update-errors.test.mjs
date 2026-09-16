import assert from 'node:assert/strict';
import test from 'node:test';

import { errorDetail, updateErrorMessage } from '../app/update-errors.ts';

const classifiedErrors = [
  ['check', 'Command plugin:updater|check not allowed by ACL', 'non è autorizzata'],
  ['check', 'signature verification failed', 'integrità'],
  ['check', 'invalid release JSON manifest', 'dati della release'],
  ['check', 'request timed out', '30 secondi'],
  ['check', 'HTTP 404 not found', 'non è disponibile'],
  ['check', 'HTTP 403 forbidden', 'rifiutato temporaneamente'],
  ['check', 'TLS certificate error', 'connessione sicura'],
  ['check', 'DNS name resolution failed', 'non è stato risolto'],
  ['check', 'proxy refused connection', 'proxy di rete'],
  ['install', 'disk full: no space left', 'spazio disponibile'],
  ['install', 'access denied (os error 5)', 'Windows non consente'],
  ['install', 'failed to move file because it is locked', 'file dell’app'],
  ['check', 'error sending request: network socket closed', 'raggiungere GitHub'],
  ['download', 'unexpected downloader failure', 'download non è stato completato'],
  ['install', 'unexpected installer failure', 'installazione non è riuscita'],
  ['relaunch', 'unexpected restart failure', 'riavvio automatico'],
  ['fallback', 'unexpected browser failure', 'aprire il browser'],
  ['check', 'unexpected updater failure', 'controllo degli aggiornamenti'],
];

test('classifica gli errori noti e conserva un fallback per quelli sconosciuti', () => {
  for (const [stage, detail, expected] of classifiedErrors) {
    assert.match(updateErrorMessage(stage, detail), new RegExp(expected, 'i'));
  }
});

test('normalizza il dettaglio tecnico senza lasciare input vuoti o illimitati', () => {
  assert.equal(errorDetail(new Error('errore\n su più righe')), 'errore su più righe');
  assert.equal(errorDetail('   '), 'Errore sconosciuto');
  assert.equal(errorDetail('x'.repeat(600)).length, 500);

  const cyclic = {};
  cyclic.self = cyclic;
  assert.equal(errorDetail(cyclic), '[object Object]');
});
