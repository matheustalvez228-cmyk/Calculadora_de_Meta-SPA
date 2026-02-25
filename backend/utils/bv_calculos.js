// Utilities for BV CARTÃO calculations

function classifyDias(dias) {
  // Return object {class: 'CL1'|'CL2', faixa: '1'|'2'|'3'}
  const d = Number(dias) || 0;
  if (d >= 95 && d <= 120) return { cls: 'CL1', faixa: '1' };
  if (d >= 121 && d <= 180) return { cls: 'CL1', faixa: '2' };
  if (d >= 181 && d <= 360) return { cls: 'CL1', faixa: '3' };
  if (d >= 361 && d <= 720) return { cls: 'CL2', faixa: '1' };
  if (d > 720) return { cls: 'CL2', faixa: '2' };
  return { cls: 'UNKNOWN', faixa: '0' };
}

function calculateReceivedForCard(entry) {
  // entry: { dias_atraso, acordo (0|1), acordo_performance, boleto_value }
  const dias = Number(entry.dias_atraso || 0);
  const cls = classifyDias(dias);
  if (cls.cls === 'CL1') {
    // CL1: operator receives 30% of performance realized in agreement (parcelado ou à vista)
    const perf = Number(entry.acordo_performance || 0);
    return Number((0.3 * perf).toFixed(2));
  }
  if (cls.cls === 'CL2') {
    // CL2: always boleto value
    return Number((Number(entry.boleto_value || 0)).toFixed(2));
  }
  // Default fallback: 0
  return 0;
}

module.exports = {
  classifyDias,
  calculateReceivedForCard
};
