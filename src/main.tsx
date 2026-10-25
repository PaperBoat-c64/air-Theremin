import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// No StrictMode: this is a real-time instrument and double-mounted effects
// would spawn duplicate audio contexts and render loops.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
