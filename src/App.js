// src/App.js

/* eslint-disable react/jsx-pascal-case */
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import UserGuide from './components/UserGuide';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import Login from './components/Login';
import Mypage from './components/Mypage';
import Save from './components/Save';
import Read from './components/Read';
import Report_a from './components/Report_a';
import Save_report from './components/Save_report';
import Trash from './components/Trash';
import Trashread from './components/Trashread';
import SignUp from './components/SignUp';
/* eslint-enable react/jsx-pascal-case */

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/guide" element={<UserGuide />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/login" element={<Login />} />
        <Route path="/mypage" element={<Mypage />} />
        <Route path="/save" element={<Save />} />
        <Route path="/read" element={<Read />} />
        <Route path="/report_a" element={<Report_a />} />
        <Route path="/save_report" element={<Save_report />} />
        <Route path="/trash" element={<Trash />} />
        <Route path="/trashread" element={<Trashread />} />
        <Route path="/signup" element={<SignUp />} />
      </Routes>
    </Router>
  );
}

export default App;
