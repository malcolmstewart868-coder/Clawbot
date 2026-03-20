type AuthorityTimelineItem = {
  ts: number;
  from: string;
  to: string;
  reason: string;
};

type Props = {
  timeline?: AuthorityTimelineItem[];
};

function formatTs(ts?: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

export default function AuthorityTimeline({ timeline = [] }: Props) {
  return (
    <div className="data-card">
      <h2>Authority Timeline</h2>

      {timeline.length === 0 ? (
        <div className="empty-note">No authority transitions recorded yet.</div>
      ) : (
        <div className="timeline-list">
          {timeline
            .slice()
            .reverse()
            .map((item, idx) => (
              <div className="timeline-item" key={`${item.ts}-${idx}`}>
                <div className="timeline-time">{formatTs(item.ts)}</div>
                <div className="timeline-main">
                  <span className="timeline-from">{item.from}</span>
                  <span className="timeline-arrow">→</span>
                  <span className="timeline-to">{item.to}</span>
                </div>
                <div className="timeline-reason">{item.reason}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}