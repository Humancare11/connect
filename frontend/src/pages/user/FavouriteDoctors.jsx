import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function FavouriteDoctors() {
  const [favouriteDoctors, setFavouriteDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavouriteDoctors();
  }, []);

  const fetchFavouriteDoctors = async () => {
    try {
      // For now, we'll simulate this with a placeholder
      // In a real app, you'd have an API endpoint for user's favourite doctors
      setFavouriteDoctors([]);
    } catch (error) {
      console.error("Failed to fetch favourite doctors:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavourite = async (doctorId) => {
    try {
      // API call to remove from favourites
      setFavouriteDoctors(favouriteDoctors.filter(doc => doc._id !== doctorId));
    } catch (error) {
      console.error("Failed to remove favourite:", error);
    }
  };

  return (
    <div className="favourite-doctors-page">
      <div className="page-header">
        <h1 className="page-title">Favourite Doctors</h1>
        <p className="page-subtitle">Your saved healthcare professionals</p>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link to="/find-a-doctor" className="btn-primary">
          <span className="btn-icon">🔍</span>
          Find More Doctors
        </Link>
      </div>

      {/* Favourite Doctors List */}
      <div className="section-card">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your favourite doctors...</p>
          </div>
        ) : favouriteDoctors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">❤️</div>
            <h4>No favourite doctors yet</h4>
            <p>Start exploring doctors and add them to your favourites for quick access.</p>
            <Link to="/find-a-doctor" className="btn-primary">
              Browse Doctors
            </Link>
          </div>
        ) : (
          <div className="doctors-grid">
            {favouriteDoctors.map((doctor) => (
              <div key={doctor._id} className="doctor-card">
                <div className="doctor-header">
                  <div className="doctor-avatar">
                    {doctor.name?.charAt(0) || "D"}
                  </div>
                  <div className="doctor-actions">
                    <button
                      className="btn-icon favourite"
                      onClick={() => removeFavourite(doctor._id)}
                      title="Remove from favourites"
                    >
                      ❤️
                    </button>
                  </div>
                </div>

                <div className="doctor-info">
                  <h4>{doctor.name}</h4>
                  <p className="specialization">{doctor.specialization || "General Physician"}</p>
                  <p className="experience">
                    {doctor.experience ? `${doctor.experience} years experience` : "Experienced Professional"}
                  </p>
                </div>

                <div className="doctor-stats">
                  <div className="stat">
                    <span className="stat-value">{doctor.rating || "4.5"}</span>
                    <span className="stat-label">Rating</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{doctor.reviews || "120"}</span>
                    <span className="stat-label">Reviews</span>
                  </div>
                </div>

                <div className="doctor-actions">
                  <Link to={`/doctor/${doctor._id}`} className="btn-outline">
                    View Profile
                  </Link>
                  <Link to={`/book-appointment?doctor=${doctor._id}`} className="btn-primary">
                    Book Appointment
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions */}
      {favouriteDoctors.length > 0 && (
        <div className="section-card">
          <h3>Recommended for You</h3>
          <p>Based on your favourite doctors, here are some similar professionals:</p>
          <div className="suggestions-grid">
            {/* Placeholder for recommendations */}
            <div className="suggestion-card">
              <div className="suggestion-content">
                <h4>Discover More Doctors</h4>
                <p>Explore doctors in similar specializations</p>
                <Link to="/find-a-doctor" className="btn-secondary">
                  Explore Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}