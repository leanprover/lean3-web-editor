/// <reference types="monaco-editor" />
import { InfoRecord, LeanJsOpts, Message, Severity } from 'lean-client-js-browser';
import * as React from 'react';
import { findDOMNode, render } from 'react-dom';
import * as sp from 'react-split-pane';
import { allMessages, currentlyRunning, registerLeanLanguage, server } from './langservice';
export const SplitPane: any = sp;

const codeBlockStyle = {
  display: 'block',
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
  marginTop: '1em',
  fontSize: '110%',
};

function leanColorize(text: string): string {
  // TODO(gabriel): use promises
  const colorized: string = (monaco.editor.colorize(text, 'lean', {}) as any)._value;
  return colorized.replace(/&nbsp;/g, ' ');
}

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
      <div style={codeBlockStyle} dangerouslySetInnerHTML={{__html: leanColorize(msg.text)}}/>
    </div>
  );
}

interface Position {
  line: number;
  column: number;
}

interface GoalWidgetProps {
  goal: InfoRecord;
  position: Position;
}
function GoalWidget({goal, position}: GoalWidgetProps) {
  return (
    <div style={{paddingBottom: '1em'}}>
      <div style={{borderBottom: '1px solid', fontWeight: 'bold', fontFamily: 'sans-serif'}}>
        goal at {position.line}:{position.column}</div>
      <div style={codeBlockStyle} dangerouslySetInnerHTML={{__html: leanColorize(goal.state)}}/>
    </div>
  );
}

interface InfoViewProps {
  file: string;
  cursor?: Position;
}
interface InfoViewState {
  goal?: GoalWidgetProps;
  messages: Message[];
}
class InfoView extends React.Component<InfoViewProps, InfoViewState> {
  private subscriptions: monaco.IDisposable[] = [];

  constructor(props: InfoViewProps) {
    super(props);
    this.state = { messages: [] };
  }

  componentWillMount() {
    this.updateMessages(this.props);
    this.subscriptions.push(
      server.allMessages.on((allMsgs) => this.updateMessages(this.props)),
    );
  }

  updateMessages(nextProps) {
    this.setState({
      messages: allMessages.filter((v) => v.file_name === this.props.file),
    });
  }

  componentWillUnmount() {
    for (const s of this.subscriptions) {
      s.dispose();
    }
    this.subscriptions = [];
  }

  render() {
    const goal = this.state.goal && (<div key={'goal'}>{GoalWidget(this.state.goal)}</div>);
    const msgs = this.state.messages.map((msg, i) =>
      (<div key={i}>{MessageWidget({msg})}</div>));
    return (
      <div>
        {goal}
        {msgs}
      </div>
    );
  }

  componentWillReceiveProps(nextProps) {
    this.updateMessages(nextProps);
    this.refreshGoal(nextProps);
  }

  refreshGoal(nextProps?: InfoViewProps) {
    if (!nextProps) {
      nextProps = this.props;
    }
    if (!nextProps.cursor) {
      return;
    }

    const position = nextProps.cursor;
    server.info(nextProps.file, position.line, position.column).then((res) => {
      this.setState({goal: res.record && res.record.state && { goal: res.record, position }});
    });
  }
}

interface PageHeaderProps {
  file: string;
}
interface PageHeaderState {
  currentlyRunning: boolean;
}
class PageHeader extends React.Component<PageHeaderProps, PageHeaderState> {
  private subscriptions: monaco.IDisposable[] = [];

  constructor(props: PageHeaderProps) {
    super(props);
    this.state = { currentlyRunning: true };
  }

  componentWillMount() {
    this.updateRunning(this.props);
    this.subscriptions.push(
      currentlyRunning.updated.on((fns) => this.updateRunning(this.props)),
    );
  }

  updateRunning(nextProps) {
    this.setState({
      currentlyRunning: currentlyRunning.value.indexOf(nextProps.file) !== -1,
    });
  }

  componentWillUnmount() {
    for (const s of this.subscriptions) {
      s.dispose();
    }
    this.subscriptions = [];
  }

  render() {
    const isRunning = this.state.currentlyRunning &&
      <div style={{fontStyle: 'italic'}}>(running...)</div>;
    return (
      <div style={{height: '100%'}}>
        <img src='./lean_logo.svg' style={{height: '100%', float: 'left', paddingLeft: '1em', paddingRight: '3em'}}/>
        <div style={{padding: '1em'}}>
          <div style={{fontSize: '80%'}}>
            Live in-browser version of the <a href='https://leanprover.github.io/'>Lean theorem prover</a>.<br/>
            Blank right side pane means the proof checks out ok.
          </div>
          {isRunning}
        </div>
      </div>
    );
  }

  componentWillReceiveProps(nextProps) {
    this.updateRunning(nextProps);
  }
}

interface LeanEditorProps {
  file: string;
  initialValue: string;
  onValueChange?: (value: string) => void;
}
interface LeanEditorState {
  cursor?: Position;
  split: 'vertical' | 'horizontal';
}
class LeanEditor extends React.Component<LeanEditorProps, LeanEditorState> {
  model: monaco.editor.IModel;
  editor: monaco.editor.IStandaloneCodeEditor;

  constructor(props) {
    super(props);
    this.state = {split: 'vertical'};
    this.model = monaco.editor.createModel(this.props.initialValue, 'lean', monaco.Uri.file(this.props.file));
    this.model.onDidChangeContent((e) =>
      this.props.onValueChange &&
      this.props.onValueChange(this.model.getValue()));
  }

  componentDidMount() {
    const node = findDOMNode(this.refs.monaco) as HTMLElement;
    const options: monaco.editor.IEditorConstructionOptions = {
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: false,
      theme: 'vs',
      cursorStyle: 'line',
      automaticLayout: true,
      cursorBlinking: 'solid',
      model: this.model,
      minimap: {enabled: false},
    };
    this.editor = monaco.editor.create(node, options);
    this.editor.onDidChangeCursorPosition((e) =>
      this.setState({cursor: {line: e.position.lineNumber, column: e.position.column - 1}}));
    this.determineSplit();
    window.addEventListener('resize', this.updateDimensions.bind(this));
  }
  componentWillUnmount() {
    this.editor.dispose();
    this.editor = undefined;
    window.removeEventListener('resize', this.updateDimensions.bind(this));
  }

  updateDimensions() {
    this.determineSplit();
  }
  determineSplit() {
    const node = findDOMNode(this.refs.root) as HTMLElement;
    this.setState({split: node.clientHeight > node.clientWidth ? 'horizontal' : 'vertical'});
  }

  render() {
    return (<div>
      <div style={{height: '5em', overflow: 'hidden'}}>
        <PageHeader file={this.props.file}/>
      </div>
      <div style={{height: 'calc(99vh - 5em)', width: '100%', position: 'relative'}} ref='root'>
        <SplitPane split={this.state.split} defaultSize='50%' allowResize={true}>
          <div ref='monaco' style={{
            height: '100%', width: '100%',
            margin: '1ex', marginRight: '2em',
            overflow: 'hidden'}}/>
          <div style={{overflowY: 'scroll', height: 'calc(100% - 10px)', margin: '1ex' }}>
            <InfoView file={this.props.file} cursor={this.state.cursor}/>
          </div>
        </SplitPane>
      </div>
    </div>);
  }
}

const defaultValue =
  '-- An example proof in Lean\n\nexample (m n : ℕ) : m + n = n + m :=\nby simp';

function App() {
  let value = defaultValue;
  if (window.location.hash.startsWith('#code=')) {
    value = decodeURI(window.location.hash.substring(6));
  }

  const fn = monaco.Uri.file('test.lean').fsPath;
  return (
    <LeanEditor file={fn} initialValue={value} onValueChange={(newValue) => {
      history.replaceState(undefined, undefined, '#code=' + encodeURI(newValue));
    }} />
  );
}

const leanJsOpts: LeanJsOpts = {
  javascript: './lean_js_js.js',
  libraryZip: './library.zip',
  webassemblyJs: './lean_js_wasm.js',
  webassemblyWasm: './lean_js_wasm.wasm',
};

// tslint:disable-next-line:no-var-requires
(window as any).require(['vs/editor/editor.main'], () => {
  registerLeanLanguage(leanJsOpts);
  render(
      <App />,
      document.getElementById('root'),
  );
});
