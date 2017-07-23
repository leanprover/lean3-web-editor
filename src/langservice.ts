/// <reference types="monaco-editor" />
import * as lean from 'lean-client-js-browser';
import {leanSyntax} from './syntax';

const leanJsOpts: lean.LeanJsOpts = {
  javascript: 'https://leanprover.github.io/lean.js/lean3.js',
};

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

export let server: lean.Server;

const watchers = new Map<string, ModelWatcher>();

const delayMs = 200;

class ModelWatcher implements monaco.IDisposable {
    private changeSubscription: monaco.IDisposable;
    private syncTimer = new CoalescedTimer();

    constructor(private model: monaco.editor.IModel) {
        this.changeSubscription = model.onDidChangeContent( () => {
            completionBuffer.cancel();
            this.syncIn(delayMs);
        });
    }

    dispose() { this.changeSubscription.dispose(); }

    syncIn(ms: number) {
        this.syncTimer.do(ms, () => {
            if (!server) {
                return;
            }
            server.sync(this.model.uri.fsPath, this.model.getValue());
        });
    }

    syncNow() { this.syncIn(0); }
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

export function registerLeanLanguage() {
  if (server) {
    return;
  }

  const transport =
      (window as any).Worker ?
          new lean.WebWorkerTransport(leanJsOpts) :
          new lean.BrowserInProcessTransport(leanJsOpts);
  server = new lean.Server(transport);
  server.error.on((err) => console.log('error:', err));
  server.connect();

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
    for (const model of monaco.editor.getModels()) {
      const fn = model.uri.fsPath;
      const markers: monaco.editor.IMarkerData[] = [];
      for (const msg of allMsgs.msgs) {
        const marker: monaco.editor.IMarkerData = {
          severity: toSeverity(msg.severity),
          message: msg.text,
          startLineNumber: msg.pos_line,
          startColumn: msg.pos_col + 1,
          endLineNumber: msg.pos_line,
          endColumn: msg.pos_col + 1,
        };
        if (msg.end_pos_line && msg.end_pos_col) {
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
    }),
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
