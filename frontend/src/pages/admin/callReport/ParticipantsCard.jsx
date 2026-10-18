// "Participants" section of an admin call report. The table chrome is shared;
// each report supplies its own columns (the direct call and the appointment
// call track different things). `columns`: [{ header, render(participant) }].
export default function ParticipantsCard({ participants, columns, rowKey, emptyText }) {
  return (
    <div className="dvc-card">
      <div className="dvc-form__title">
        <h2>Participants</h2>
      </div>
      {participants.length === 0 ? (
        <div className="dvc-empty">{emptyText}</div>
      ) : (
        <div className="dvc-table-wrap">
          <table className="dvc-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={rowKey(p)}>
                  {columns.map((c) => (
                    <td key={c.header}>{c.render(p)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
