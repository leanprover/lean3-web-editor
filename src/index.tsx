/// <reference types="monaco-editor" />
import * as React from 'react';
import { render } from 'react-dom';
import MonacoEditor from 'react-monaco-editor';
import * as SplitPane from 'react-split-pane';
import {registerLeanLanguage} from './langservice';

interface LeanEditorProps {
  file: string;
}
interface LeanEditorState {
  code: string;
}
class LeanEditor extends React.Component<LeanEditorProps, LeanEditorState> {
  editor: monaco.editor.ICodeEditor;

  constructor(props) {
    super(props);
    this.state = {
      code: '-- lean demo\n\ndef foo : nat := 5',
    };
  }

  editorDidMount(editor: monaco.editor.ICodeEditor) {
    this.editor = editor;
  }

  onChange(newValue, e: monaco.editor.IModel) {
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
          />
        </div>
    );
  }
}

class App extends React.Component {
  render() {
    return (
        <LeanEditor file='test.lean' />
    );
  }
}

// tslint:disable-next-line:no-var-requires
(window as any).require(['vs/editor/editor.main'], () => {
  registerLeanLanguage();
  render(
      <App />,
      document.getElementById('root'),
  );
});
