/// <reference types="monaco-editor" />
import * as React from 'react';
import { render } from 'react-dom';
import MonacoEditor from 'react-monaco-editor';
import * as SplitPane from 'react-split-pane';
import {registerLeanLanguage} from './langservice';

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
        <div>
          {/* <div>
            <button onClick={() => this.changeEditorValue()}>Change value</button>
            <button onClick={() => this.changeBySetState()}>Change by setState</button>
          </div>
          <p/> */}
          <MonacoEditor
              height='500'
              language='lean'
              value={code}
              options={options}
              editorDidMount={(e) => this.editorDidMount(e)}
              onChange={(v, e) => this.onChange(v, e)}
          />
        </div>
    );
  }
}

class App extends React.Component {
  render() {
    return (
        <LeanEditor file='test.lean' persistent={true} />
    );
  }
}

const leanJsOpts = {
  javascript: 'https://leanprover.github.io/lean.js/lean3.js',
};

// tslint:disable-next-line:no-var-requires
(window as any).require(['vs/editor/editor.main'], () => {
  registerLeanLanguage(leanJsOpts);
  render(
      <App />,
      document.getElementById('root'),
  );
});
