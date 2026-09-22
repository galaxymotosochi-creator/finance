import { useEffect, useState } from 'react';

/**
 * Атлас — робот-помощник раздела AI.
 * mood: 'calm' | 'listen' | 'think' | 'joy' | 'sad'
 */
export default function Atlas({ mood = 'calm', size = 1, onClick }) {
  const [m, setM] = useState(mood);
  useEffect(() => { setM(mood); }, [mood]);

  const s = (v) => v * size;

  return (
    <div className={'atlas atlas-' + m} style={{ transform: 'scale(' + size + ')', transformOrigin: 'center bottom', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="atlas-stage">
        <div className="atlas-halo"></div>
        <div className="atlas-halo atlas-halo2"></div>
        <div className="atlas-shadow"></div>
        <div className="atlas-float">
          <div className="atlas-bot">
            <div className="atlas-ant"></div>
            <div className="atlas-ear atlas-ear-l"></div>
            <div className="atlas-ear atlas-ear-r"></div>
            <div className="atlas-head">
              <div className="atlas-visor">
                <span className="atlas-eye"></span>
                <span className="atlas-eye"></span>
              </div>
              <div className="atlas-mouth"></div>
            </div>
            <div className="atlas-torso-row">
              <div className="atlas-arm atlas-arm-l"></div>
              <div className="atlas-torso"></div>
              <div className="atlas-arm atlas-arm-r"></div>
            </div>
            <div className="atlas-gloss"></div>
            <div className="atlas-think-dots">⋯</div>
          </div>
        </div>
      </div>
    </div>
  );
}
