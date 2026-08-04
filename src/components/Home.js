import React from 'react';
import image1 from './image-1.png';
import image2 from './image-2.png';
import image3 from './image-3.png';
import image4 from './image-4.png';
import { useNavigate } from 'react-router-dom';
import './Home.css';

export const Home = () => {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <div className="div">
        <div className="frame">
          <div className="overlap">
            <div className="overlap-group">
              <img className="image" alt="Image" src={image1} />

              <div className="focus-smarter-learn">
                Focus Smarter, <br />
                learn Better
              </div>
            </div>

            <div className="START-wrapper">
              <button
                className="text-wrapper"
                onClick={() => navigate('/login')}
              >
                Start
              </button>
            </div>
          </div>
        </div>

        <div className="overlap-2">
          <div className="rectangle" />

          <img className="img" alt="Image" src={image3} />

          <img className="image-2" alt="Image" src={image2} />

          <img className="image-3" alt="Image" src={image4} />

          <div className="rectangle-2" />

          <div className="text-wrapper-2">Our Vision</div>
        </div>

        <p className="p">Zoner : 학습에 혁신을 더하다</p>

        <div className="text-wrapper-3">ZONER</div>

        <div className="ZONER-wrapper">
          <button className="ZONER">Zoner</button>
        </div>

        <div className="USER-GUIDE-wrapper">
          <button className="text-wrapper-U" onClick={() => navigate('/guide')}>
            User Guide
          </button>
        </div>

        <div className="PRICING-wrapper">
          <button
            className="text-wrapper-U"
            onClick={() => navigate('/pricing')}
          >
            Pricing
          </button>
        </div>

        <div className="FAQ-wrapper">
          <button className="text-wrapper-U" onClick={() => navigate('/faq')}>
            Faq
          </button>
        </div>
      </div>
    </div>
  );
};
export default Home;
