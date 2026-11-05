import { LAYERS } from '../data/layers.js';
import { SignalLab, SwitchLab, RoutingLab } from './LabsLow.jsx';
import { TransportLab, SessionLab, PresentationLab, HttpLab } from './LabsHigh.jsx';

const LABS = { 1: SignalLab, 2: SwitchLab, 3: RoutingLab, 4: TransportLab, 5: SessionLab, 6: PresentationLab, 7: HttpLab };

export default function LabView({ layer, setLayer }) {
  const Lab = LABS[layer];
  return (
    <>
      <div className="lab-switch" aria-label="Choose lab layer">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button key={n} className={n === layer ? 'on' : ''} style={{ '--lc': LAYERS[n].color }} title={`${LAYERS[n].name} lab`} onClick={() => setLayer(n)}>{n}</button>
        ))}
      </div>
      <div className="lab"><Lab /></div>
    </>
  );
}
