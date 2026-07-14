import React from 'react';
import NethajiEsign from '../assets/NethajiEsign.png';

function Images() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}
    >
      <img
        src={NethajiEsign}
        alt="Nethaji E-Sign"
        style={{
          maxWidth: '100%',
          height: 'auto',
        }}
      />
    </div>
  );
}

export default Images;