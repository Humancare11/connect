import "./AmbientBackdrop.css";

function AmbientBackdrop() {
  return (
    <div className="ambient-bg">
      {/* Main Orbs */}
      <div className="ambient-orb orb-blue"></div>
      <div className="ambient-orb orb-light"></div>
      <div className="ambient-orb orb-bottom"></div>

      {/* Mesh Gradient Layer */}
      <div className="ambient-mesh"></div>

      {/* Grid Layer */}
      <div className="ambient-grid"></div>

      {/* Noise / Grain */}
      <div className="ambient-grain"></div>

      {/* Glow Lines */}
      <div className="ambient-lines"></div>

      {/* Vignette */}
      <div className="ambient-vignette"></div>
    </div>
  );

}

export default AmbientBackdrop;