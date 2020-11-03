/// <reference types="monaco-editor" />
import * as lean from 'lean-client-js-browser';
import {leanSyntax} from './syntax';
import * as translations from './translations.json';

export class CoalescedTimer {
  private timer: number = undefined;
  do(ms: number, f: () => void) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      f();
    }, ms) as any;
  }
}

export class ReactiveValue<E> {
  updated = new lean.Event<E>();
  private lastValue: E;

  constructor(initialValue: E) {
    this.lastValue = initialValue;
    this.updated.on((e) => this.lastValue = e);
  }

  get value() { return this.lastValue; }
}

export let server: lean.Server;
export let allMessages: lean.Message[] = [];

export const currentlyRunning = new ReactiveValue<string[]>([]);
function addToRunning(fn: string) {
  if (currentlyRunning.value.indexOf(fn) === -1) {
    currentlyRunning.updated.fire([].concat([fn], currentlyRunning.value));
  }
}
function removeFromRunning(fn: string) {
  currentlyRunning.updated.fire(currentlyRunning.value.filter((v) => v !== fn));
}

const watchers = new Map<string, ModelWatcher>();

export let delayMs = 1000;

class ModelWatcher implements monaco.IDisposable {
  private changeSubscription: monaco.IDisposable;
  private syncTimer = new CoalescedTimer();
  private version = 0;

  constructor(private model: monaco.editor.IModel) {
    this.changeSubscription = model.onDidChangeContent((e) => {
      completionBuffer.cancel();
      // this.checkInputCompletion(e);
      this.syncIn(delayMs);
    });
    this.syncNow();
  }

  dispose() { this.changeSubscription.dispose(); }

  syncIn(ms: number) {
    addToRunning(this.model.uri.fsPath);
    completionBuffer.cancel();
    const version = (this.version += 1);
    this.syncTimer.do(ms, () => {
      if (!server) {
        return;
      }
      server.sync(this.model.uri.fsPath, this.model.getValue()).then(() => {
        if (this.version === version) {
          removeFromRunning(this.model.uri.fsPath);
        }
      });
    });
  }

  syncNow() { this.syncIn(0); }
}

const triggerChars = new Set(' ,');
export function checkInputCompletionChange(e: monaco.editor.IModelContentChangedEvent,
                                           editor: monaco.editor.IStandaloneCodeEditor,
                                           model: monaco.editor.IModel): void {
  if (e.changes.length !== 1) {
    return null;
  }
  const change = e.changes[0];
  if (change.rangeLength === 0 && triggerChars.has(change.text)) {
    completionEdit(editor, model, true);
  }
  return null;
}

// completionEdit() assumes that all these are 2 characters long!
const hackyReplacements = {
  ['{{}}']: '⦃⦄',
  ['[[]]']: '⟦⟧',
  ['<>']: '⟨⟩',
  ['([])']: '⟮⟯',
  ['f<>']: '‹›',
  ['f<<>>']: '«»',
};
export function checkInputCompletionPosition(e: monaco.editor.ICursorPositionChangedEvent,
                                             editor: monaco.editor.IStandaloneCodeEditor,
                                             model: monaco.editor.IModel): boolean {
  const lineNum = e.position.lineNumber;
  const line = model.getLineContent(lineNum);
  const cursorPos = e.position.column;
  const index = line.lastIndexOf('\\', cursorPos - 1) + 1;
  const match = line.substring(index, cursorPos - 1);
  // ordinary completion
  const replaceText = index && translations[match];
  // hacky completions put the cursor between paired Unicode brackets
  const hackyReplacement = index && hackyReplacements[match];
  return replaceText || hackyReplacement;
}

function completionEdit(editor: monaco.editor.IStandaloneCodeEditor,
                        model: monaco.editor.IModel, triggeredByTyping: boolean): void {
  const sel = editor.getSelections();
  const lineNum = sel[0].startLineNumber;
  const line = model.getLineContent(lineNum);
  const cursorPos = sel[0].startColumn;
  const index = line.lastIndexOf('\\', cursorPos - 1) + 1;
  const match = line.substring(index, cursorPos - 1);
  // ordinary completion
  const replaceText = index && translations[match];
  // hacky completions put the cursor between paired Unicode brackets
  const hackyReplacement = index && hackyReplacements[match];
  if (replaceText || hackyReplacement) {
    if (triggeredByTyping) {
      const range1 = new monaco.Range(lineNum, index, lineNum, cursorPos);
      editor.executeEdits(null, [{
        identifier: {major: 1, minor: 1},
        range: range1,
        text: replaceText || hackyReplacement[0],
        forceMoveMarkers: false,
      }], [new monaco.Selection(lineNum, index + 1, lineNum, index + 1)]);
      if (hackyReplacement) {
        // put the closing bracket after the typed character
        const range2 = new monaco.Range(lineNum, index + 2, lineNum, index + 2);
        editor.executeEdits(null, [{
          identifier: {major: 1, minor: 1},
          range: range2,
          text: hackyReplacement[1],
          forceMoveMarkers: false,
        }], [new monaco.Selection(lineNum, index + 1, lineNum, index + 1)]);
      }
      // HACK: monaco seems to move the cursor AFTER the onDidChangeModel event handlers are called,
      // so we move the cursor +1 character to the right so that it's immediately after the typed character
      // (assumes all unicode translations are 1 character long and
      // all hackyReplacements have a 1-character opening brace!)
      global.setTimeout(() => editor.setPosition(new monaco.Position(lineNum, index + 2)), 0);
    } else {
      const range = new monaco.Range(lineNum, index, lineNum, cursorPos);
      editor.executeEdits(null, [{
        identifier: {major: 1, minor: 1},
        range,
        text: replaceText || hackyReplacement,
        forceMoveMarkers: false,
      }], [new monaco.Selection(lineNum, index + 1, lineNum, index + 1)]);
      // index + 1: the final cursor position is one character to the right of the initial '\'
      // (assumes all unicode translations are 1 character long and
      // all hackyReplacements have a 1-character opening brace!)
    }
  }
}

export function tabHandler(editor: monaco.editor.IStandaloneCodeEditor,
                           model: monaco.editor.IModel): void {
  completionEdit(editor, model, false);
}

class CompletionBuffer {
    private reject: (reason: any) => void;
    private timer;

    wait(ms: number): Promise<void> {
        this.cancel();
        return new Promise<void>((resolve, reject) => {
            this.reject = reject;
            this.timer = setTimeout(() => {
                this.timer = undefined;
                resolve();
            }, ms);
        });
    }
    cancel() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.reject('timeout');
            this.timer = undefined;
        }
    }
}
const completionBuffer = new CompletionBuffer();

function toSeverity(severity: lean.Severity): monaco.Severity {
  switch (severity) {
    case 'warning': return monaco.Severity.Warning;
    case 'error': return monaco.Severity.Error;
    case 'information': return monaco.Severity.Info;
  }
}

export function registerLeanLanguage(leanJsOpts: lean.LeanJsOpts) {
  if (server) {
    return;
  }

  const transport = new lean.WebWorkerTransport(leanJsOpts);
  server = new lean.Server(transport);
  server.error.on((err) => console.log('error:', err));
  server.connect();
  // server.logMessagesToConsole = true;
  server.logMessagesToConsole = window.localStorage.getItem('logging') === 'true';

  monaco.languages.register({
    id: 'lean',
    filenamePatterns: ['*.lean'],
  });

  monaco.editor.onDidCreateModel((model) => {
    if (model.getModeId() === 'lean') {
        watchers.set(model.uri.fsPath, new ModelWatcher(model));
    }
  });
  monaco.editor.onWillDisposeModel((model) => {
      const watcher = watchers.get(model.uri.fsPath);
      if (watcher) {
          watcher.dispose();
          watchers.delete(model.uri.fsPath);
      }
  });

  server.allMessages.on((allMsgs) => {
    allMessages = allMsgs.msgs;
    for (const model of monaco.editor.getModels()) {
      const fn = model.uri.fsPath;
      const markers: monaco.editor.IMarkerData[] = [];
      for (const msg of allMsgs.msgs) {
        if (msg.file_name !== fn) {
          continue;
        }
        const marker: monaco.editor.IMarkerData = {
          severity: toSeverity(msg.severity),
          message: msg.text,
          startLineNumber: msg.pos_line,
          startColumn: msg.pos_col + 1,
          endLineNumber: msg.pos_line,
          endColumn: msg.pos_col + 1,
        };
        if (msg.end_pos_line && msg.end_pos_col !== undefined) {
          marker.endLineNumber = msg.end_pos_line;
          marker.endColumn = msg.end_pos_col + 1;
        }
        markers.push(marker);
      }
      monaco.editor.setModelMarkers(model, 'lean', markers);
    }
  });

  monaco.languages.registerCompletionItemProvider('lean', {
    provideCompletionItems: (editor, position) =>
      completionBuffer.wait(delayMs).then(() => {
        watchers.get(editor.uri.fsPath).syncNow();
        return server.complete(editor.uri.fsPath, position.lineNumber, position.column - 1).then((result) => {
            const items: monaco.languages.CompletionItem[] = [];
            for (const compl of result.completions || []) {
            const item = {
                kind: monaco.languages.CompletionItemKind.Function,
                label: compl.text,
                detail: compl.type,
                documentation: compl.doc,
                range: new monaco.Range(position.lineNumber, position.column - result.prefix.length,
                    position.lineNumber, position.column),
            };
            if (compl.tactic_params) {
                item.detail = compl.tactic_params.join(' ');
            }
            items.push(item);
            }
            return items;
        });
    }, () => undefined),
  });

  monaco.languages.registerHoverProvider('lean', {
    provideHover: (editor, position): Promise<monaco.languages.Hover> => {
      return server.info(editor.uri.fsPath, position.lineNumber, position.column - 1).then((response) => {
        const marked: monaco.MarkedString[] = [];
        const record = response.record;
        if (!record) {
            return {contents: []} as monaco.languages.Hover;
        }
        const name = record['full-id'] || record.text;
        if (name) {
          if (response.record.tactic_params) {
            marked.push({
              language: 'text',
              value: name + ' ' + record.tactic_params.join(' '),
            });
          } else {
            marked.push({
              language: 'lean',
              value: name + ' : ' + record.type,
            });
          }
        }
        if (response.record.doc) {
          marked.push(response.record.doc);
        }
        if (response.record.state) {
          marked.push({language: 'lean', value: record.state});
        }
        return {
          contents: marked,
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
        };
      });
    },
  });

  monaco.languages.setMonarchTokensProvider('lean', leanSyntax as any);
}
