import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function LabAppointments() {
  const [labAppointments, setLabAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading lab appointments
    setTimeout(() => {
      setLabAppointments([]);
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="lab-appointments-page">
      <div className="page-header">
        <h1 className="page-title">Lab Appointments</h1>
        <p className="page-subtitle">Manage your laboratory test appointments</p>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link to="/medical-services" className="btn-primary">
          <span className="btn-icon">🧪</span>
          Book Lab Test
        </Link>
      </div>

      {/* Lab Appointments List */}
      <div className="section-card">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your lab appointments...</p>
          </div>
        ) : labAppointments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧪</div>
            <h4>No lab appointments yet</h4>
            <p>Schedule your first laboratory test for comprehensive health checkups.</p>
            <Link to="/medical-services" className="btn-primary">
              Browse Lab Tests
            </Link>
          </div>
        ) : (
          <div className="appointments-list">
            {labAppointments.map((appointment) => (
              <div key={appointment.id} className="appointment-card">
                <div className="appointment-header">
                  <div className="lab-info">
                    <div className="lab-avatar">🧪</div>
                    <div>
                      <h4>{appointment.testName}</h4>
                      <p>{appointment.labName}</p>
                    </div>
                  </div>
                  <span className={`status-badge ${appointment.status}`}>
                    {appointment.status}
                  </span>
                </div>

                <div className="appointment-details">
                  <div className="detail-item">
                    <span className="label">Date:</span>
                    <span>{appointment.date}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Time:</span>
                    <span>{appointment.time}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Location:</span>
                    <span>{appointment.location}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Price:</span>
                    <span>${appointment.price}</span>
                  </div>
                </div>

                <div className="appointment-actions">
                  {appointment.status === "upcoming" && (
                    <>
                      <button className="btn-outline">Reschedule</button>
                      <button className="btn-danger">Cancel</button>
                    </>
                  )}
                  {appointment.status === "completed" && (
                    <button className="btn-secondary">View Results</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Categories */}
      <div className="section-card">
        <h3>Popular Lab Tests</h3>
        <div className="test-categories">
          <div className="test-category">
            <div className="category-icon">🩸</div>
            <h4>Blood Tests</h4>
            <p>Complete blood count, lipid profile, diabetes screening</p>
            <Link to="/medical-services" className="btn-outline">View Tests</Link>
          </div>

          <div className="test-category">
            <div className="category-icon">🫀</div>
            <h4>Cardiac Tests</h4>
            <p>ECG, echocardiography, stress tests</p>
            <Link to="/medical-services" className="btn-outline">View Tests</Link>
          </div>

          <div className="test-category">
            <div className="category-icon">🫁</div>
            <h4>Respiratory Tests</h4>
            <p>Pulmonary function tests, chest X-rays</p>
            <Link to="/medical-services" className="btn-outline">View Tests</Link>
          </div>

          <div className="test-category">
            <div className="category-icon">🦴</div>
            <h4>Bone & Joint Tests</h4>
            <p>Density scans, arthritis markers</p>
            <Link to="/medical-services" className="btn-outline">View Tests</Link>
          </div>
        </div>
      </div>
    </div>
  );
}