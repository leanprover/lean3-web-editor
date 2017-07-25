/// <reference types="monaco-editor" />
import { InfoRecord, LeanJsOpts, Message, Severity } from 'lean-client-js-browser';
import * as React from 'react';
import { render } from 'react-dom';
import MonacoEditor from 'react-monaco-editor';
import * as SplitPane from 'react-split-pane';
import {registerLeanLanguage, server} from './langservice';

interface MessageWidgetProps {
  msg: Message;
}
function MessageWidget({msg}: MessageWidgetProps) {
  const colorOfSeverity = {
    information: 'green',
    warning: 'orange',
    error: 'red',
  };

  return (
    <div style={{paddingBottom: '1em'}}>
      <div style={{ borderBottom: '1px solid', fontFamily: 'sans-serif',
          fontWeight: 'bold', color: colorOfSeverity[msg.severity] }}>
        {msg.pos_line}:{msg.pos_col}: {msg.severity}: {msg.caption}</div>
      <pre>{msg.text}</pre>
    </div>
  );
}

interface GoalWidgetProps {
  goal: InfoRecord;
}
function GoalWidget({goal}: GoalWidgetProps) {
  return (
    <div style={{paddingBottom: '1em'}}>
      <div style={{borderBottom: '1px solid', fontWeight: 'bold', fontFamily: 'sans-serif'}}>
        goal at {goal.source.line}:{goal.source.column}</div>
      <pre>{goal.state}</pre>
    </div>
  );
}

interface InfoViewProps {
  file: string;
}
interface InfoViewState {
  goal?: InfoRecord;
  messages: Message[];
}
class InfoView extends React.Component<InfoViewProps, InfoViewState> {
  private subscriptions: monaco.IDisposable[] = [];

  constructor(props: InfoViewProps) {
    super(props);
    this.state = { messages: [] };
  }

  componentWillMount() {
    this.subscriptions.push(
      server.allMessages.on((allMsgs) => {
        this.setState({
          goal: this.state.goal,
          messages: allMsgs.msgs.filter((v) => v.file_name === this.props.file),
        });
        // this.forceUpdate();
      }),
    );
  }

  componentWillUnmount() {
    for (const s of this.subscriptions) {
      s.dispose();
    }
    this.subscriptions = [];
  }

  render() {
    const msgs = this.state.messages.map((msg, i) =>
      (<div key={i}>{MessageWidget({msg})}</div>));
    return (
      <div>
        {msgs}
      </div>
    );
  }
}

interface LeanEditorProps {
  file: string;
  persistent: boolean;
}
interface LeanEditorState {
  code: string;
}
class LeanEditor extends React.Component<LeanEditorProps, LeanEditorState> {
  editor: monaco.editor.ICodeEditor;

  constructor(props) {
    super(props);
    this.state = { code: this.getStoredCode() };
  }

  getStoredCode() {
    if (window.localStorage && this.props.persistent) {
      const contents = localStorage.getItem(this.props.file);
      if (contents) {
        return contents;
      }
    }
    return '-- Live javascript version of Lean\n\nexample (m n : ℕ) : m + n = n + m :=\nby simp';
  }
  saveCode() {
    if (window.localStorage && this.props.persistent && this.editor) {
      localStorage.setItem(this.props.file, this.editor.getValue());
    }
  }

  editorDidMount(editor: monaco.editor.ICodeEditor) {
    this.editor = editor;
  }

  onChange(newValue, e: monaco.editor.IModel) {
    this.saveCode();
  }

  changeEditorValue() {
    if (this.editor) {
      // this.editor.setValue('// code changed! \n');
    }
  }

  changeBySetState() {
    // this.setState({code: '// code changed by setState! \n'});
  }

  render() {
    const code = this.state.code;
    const options: monaco.editor.IEditorConstructionOptions = {
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: false,
      theme: 'vs',
      cursorStyle: 'line',
      automaticLayout: false,
      cursorBlinking: 'solid',
      model: monaco.editor.createModel(code, 'lean', monaco.Uri.file(this.props.file)),
    };
    return (
      <div style={{display: 'grid', gridGap: '2em'}}>
        <div style={{gridColumn: 1}}>
          <MonacoEditor
              height='800'
              language='lean'
              value={code}
              options={options}
              editorDidMount={(e) => this.editorDidMount(e)}
              onChange={(v, e) => this.onChange(v, e)}
          />
        </div>
        <div style={{gridColumn: 2}}>
          <InfoView file={this.props.file}/>
        </div>
      </div>
    );
  }
}

class App extends React.Component {
  render() {
    return (
        <LeanEditor file='/test.lean' persistent={true} />
    );
  }
}

const leanJsOpts: LeanJsOpts = {
  javascript: 'https://gebner.github.io/lean-web-editor/lean_js_js.js',
  libraryZip: 'https://gebner.github.io/lean-web-editor/library.zip',
  webassemblyJs: 'https://gebner.github.io/lean-web-editor/lean_js_wasm.js',
  webassemblyWasm: 'https://gebner.github.io/lean-web-editor/lean_js_wasm.wasm',
};

// tslint:disable-next-line:no-var-requires
(window as any).require(['vs/editor/editor.main'], () => {
  registerLeanLanguage(leanJsOpts);
  render(
      <App />,
      document.getElementById('root'),
  );
});
