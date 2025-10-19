import { useState } from 'react';
import Header from './components/Header.jsx';
import TabContainer from './components/TabContainer.jsx';
import { ModelConfigService } from './services/modelConfigService.js';
import './App.css';

function App() {
  const [modelConfig] = useState(() => new ModelConfigService());

  return (
    <div className="app">
      <Header modelConfig={modelConfig} />
      <TabContainer modelConfig={modelConfig} />
    </div>
  );
}

export default App;
