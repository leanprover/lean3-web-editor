/// <reference types="monaco-editor" />
import { InfoRecord, LeanJsOpts, Message } from 'lean-client-js-browser';
import * as React from 'react';
import { findDOMNode, render } from 'react-dom';
import * as sp from 'react-split-pane';
import { allMessages, currentlyRunning, delayMs, registerLeanLanguage, server } from './langservice';
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
  const tacticHeader = goal.text && <div style={{borderBottom: '1px solid',
    fontWeight: 'bold', fontFamily: 'sans-serif'}}>
    tactic {<span style={{fontWeight: 'normal'}}> {goal.text} </span>}
    at {position.line}:{position.column}</div>;
  const docs = goal.doc && <ToggleDoc doc={goal.doc}/>;

  const typeHeader = goal.type && <div style={{borderBottom: '1px solid',
    fontWeight: 'bold', fontFamily: 'sans-serif'}}>
    type {goal['full-id'] && <span> of <span style={{fontWeight: 'normal'}}>
      {goal['full-id']}</span> </span>}
    at {position.line}:{position.column}</div>;
  const typeBody = (goal.type && !goal.text) // don't show type of tactics
    && <div style={codeBlockStyle}
    dangerouslySetInnerHTML={{__html: leanColorize(goal.type) + (!goal.doc && '<br />')}}/>;

  const goalStateHeader = goal.state && <div style={{borderBottom: '1px solid',
    fontWeight: 'bold', fontFamily: 'sans-serif'}}>
    goal at {position.line}:{position.column}</div>;
  const goalStateBody = goal.state && <div style={codeBlockStyle}
    dangerouslySetInnerHTML={{__html: leanColorize(goal.state)}}/>;

  return (
    <div style={{paddingBottom: '1em'}}>
    {tacticHeader || typeHeader}
    {typeBody}
    {docs}
    {goalStateHeader}
    {goalStateBody}
    </div>
  );
}

interface ToggleDocProps {
  doc: string;
}
interface ToggleDocState {
  showDoc: boolean;
}
class ToggleDoc extends React.Component<ToggleDocProps, ToggleDocState> {
  constructor(props: ToggleDocProps) {
    super(props);
    this.state = { showDoc: this.props.doc.length < 80 };
    this.onClick = this.onClick.bind(this);
  }
  onClick() {
    this.setState({ showDoc: !this.state.showDoc });
  }
  render() {
    return <div onClick={this.onClick} style={{marginTop: '1em', cursor: 'pointer'}}>
      {this.state.showDoc ?
        this.props.doc : // TODO: markdown / highlighting?
        <span style={{color: '#346'}}>[show docstring]</span>}
      <br /><br />
    </div>;
  }
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
    if (nextProps.cursor === this.props.cursor) { return; }
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
      this.setState({goal: res.record && { goal: res.record, position }});
    });
  }
}

interface PageHeaderProps {
  file: string;
  url: string;
  onSubmit: (value: string) => void;
  status: string;
  onSave: () => void;
  onLoad: (localFile: string) => void;
  clearUrlParam: () => void;
}
interface PageHeaderState {
  currentlyRunning: boolean;
}
class PageHeader extends React.Component<PageHeaderProps, PageHeaderState> {
  private subscriptions: monaco.IDisposable[] = [];

  constructor(props: PageHeaderProps) {
    super(props);
    this.state = { currentlyRunning: true };
    this.onFile = this.onFile.bind(this);
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

  onFile(e) {
    const reader = new FileReader();
    const file = e.target.files[0];
    reader.readAsText(file);
    reader.onload = () => this.props.onLoad(reader.result as string);
    this.props.clearUrlParam();
  }

  render() {
    // const isRunning = this.state.currentlyRunning &&
      // <div style={{fontStyle: 'italic'}}>(running...)</div>;
    const borderStyle = this.state.currentlyRunning ? 'dotted orange 4px' : 'solid green 2px';
    // TODO: add input for delayMs ?
    return (
      <div style={{height: '100%', display: 'flex'}}>
        <img src='./lean_logo.svg' style={{height: '85%', margin: '1ex', paddingLeft: '1em',
        paddingRight: '1em', border: borderStyle, borderRadius: '15px'}}/>
        <div style={{padding: '1em', flexGrow: 1}}>
          <UrlForm url={this.props.url} onSubmit={this.props.onSubmit}
          clearUrlParam={this.props.clearUrlParam} />
          <label htmlFor='lean_upload'>Load .lean file from disk </label>
          <input id='lean_upload' type='file' accept='.lean' onChange={this.onFile} />
          <button onClick={this.props.onSave}>Save to disk</button>
          <div style={{fontSize: '80%'}}>
            Live in-browser version of the <a href='https://leanprover.github.io/'>Lean theorem prover</a>.
          </div>
          {this.props.status}
        </div>
      </div>
    );
  }

  componentWillReceiveProps(nextProps) {
    this.updateRunning(nextProps);
  }
}

interface UrlFormProps {
  url: string;
  onSubmit: (value: string) => void;
  clearUrlParam: () => void;
}
interface UrlFormState {
  value: string;
}
class UrlForm extends React.Component<UrlFormProps, UrlFormState> {
  constructor(props) {
    super(props);
    this.state = {value: this.props.url};

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({value: event.target.value});
    this.props.clearUrlParam();
  }

  handleSubmit(event) {
    this.props.onSubmit(this.state.value);
    event.preventDefault();
  }

  render() {
    return (
      <div style={{display: 'flex'}}>
      <form onSubmit={this.handleSubmit} style={{display: 'flex', justifyContent: 'flex-end',
      flex: 1}}>
        URL: <input type='text' value={this.state.value} onChange={this.handleChange}
        style={{flex: 1}}/>
        <input type='submit' value='Load' />
      </form></div>
    );
  }
}

interface LeanEditorProps {
  file: string;
  initialValue: string;
  onValueChange?: (value: string) => void;
  initialUrl: string;
  onUrlChange?: (value: string) => void;
  clearUrlParam: () => void;
}
interface LeanEditorState {
  cursor?: Position;
  split: 'vertical' | 'horizontal';
  url: string;
  status: string;
}
class LeanEditor extends React.Component<LeanEditorProps, LeanEditorState> {
  model: monaco.editor.IModel;
  editor: monaco.editor.IStandaloneCodeEditor;

  constructor(props: LeanEditorProps) {
    super(props);
    this.state = {
      split: 'vertical',
      url: this.props.initialUrl,
      status: null,
    };
    this.model = monaco.editor.createModel(this.props.initialValue, 'lean', monaco.Uri.file(this.props.file));
    this.model.onDidChangeContent((e) =>
      this.props.onValueChange &&
      this.props.onValueChange(this.model.getValue()));

    this.updateDimensions = this.updateDimensions.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onLoad = this.onLoad.bind(this);
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
      wordWrap: 'on',
      scrollBeyondLastLine: false,
    };
    this.editor = monaco.editor.create(node, options);
    this.editor.onDidChangeCursorPosition((e) =>
      this.setState({cursor: {line: e.position.lineNumber, column: e.position.column - 1}}));

    this.determineSplit();
    window.addEventListener('resize', this.updateDimensions);
  }
  componentWillUnmount() {
    this.editor.dispose();
    this.editor = undefined;
    window.removeEventListener('resize', this.updateDimensions);
  }
  componentDidUpdate() {
    // if state url is not null, fetch, then set state url to null again
    if (this.state.url) {
      try {
        fetch(this.state.url).then((s) => s.text())
          .then((s) => this.model.setValue(s));
      } catch (e) {
        // won't show CORS errors, also 404's etc. don't qualify as errors
        this.setState({ status: e.toString() });
      }
      this.setState({ url: null });
    }
  }

  updateDimensions() {
    this.determineSplit();
  }
  determineSplit() {
    const node = findDOMNode(this.refs.root) as HTMLElement;
    this.setState({split: node.clientHeight > node.clientWidth ? 'horizontal' : 'vertical'});
  }

  onSubmit(value) {
    this.props.onUrlChange(value);
    this.setState({ url: value });
  }

  onSave() {
    const file = new Blob([this.model.getValue()], { type: 'text/plain' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = this.props.file;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }

  onLoad(fileStr) {
    this.model.setValue(fileStr);
    this.props.clearUrlParam();
  }

  render() {
    return (<div>
      <div style={{height: '6.5em', overflow: 'hidden'}}>
        <PageHeader file={this.props.file} url={this.props.initialUrl}
        onSubmit={this.onSubmit} status={this.state.status}
        onSave={this.onSave} onLoad={this.onLoad} clearUrlParam={this.props.clearUrlParam} />
      </div>
      <div style={{height: 'calc(99vh - 6.5em)', width: '100%', position: 'relative'}} ref='root'>
        <SplitPane split={this.state.split} defaultSize='67%' allowResize={true}>
          <div ref='monaco' style={{
            height: '100%', width: '100%',
            margin: '2ex', marginRight: '2em',
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
  '-- Live javascript version of Lean\n\nexample (m n : ℕ) : m + n = n + m :=\nby simp';

function App() {
  const initUrl: URL = new URL(window.location.href);
  const params: URLSearchParams = initUrl.searchParams;
  // get target key/value from URLSearchParams object
  const url: string = params.has('url') ? decodeURI(params.get('url')) : null;
  const value: string = params.has('code') ? decodeURI(params.get('code')) :
    (url ? `-- loading from ${url}` : defaultValue);

  function changeUrl(newValue, key) {
    params.set(key, encodeURI(newValue));
    history.replaceState(undefined, undefined, '?' + params.toString());
  }

  function clearUrlParam() {
    params.delete('url');
    history.replaceState(undefined, undefined, '?' + params.toString());
  }

  const fn = monaco.Uri.file('test.lean').fsPath;
  return (
    <LeanEditor file={fn} initialValue={value} onValueChange={(newValue) => changeUrl(newValue, 'code')}
    initialUrl={url} onUrlChange={(newValue) => changeUrl(newValue, 'url')}
    clearUrlParam={clearUrlParam} />
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
