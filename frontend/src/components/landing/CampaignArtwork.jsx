/** NexoMark's own identity; never reads or represents a customer's saved campaign. */
export default function CampaignArtwork() {
  return (
    <div className="campaign-artwork">
      <div className="campaign-artwork-lines" aria-hidden="true"><span /><span /><span /></div>
      <img src="/nexomark-icon.png" alt="" width="1024" height="1024" decoding="async" />
      <div className="campaign-artwork-caption">
        <span>NexoMark</span>
        <p>Conecta ideas.<br />Crea campañas.</p>
      </div>
    </div>
  )
}
