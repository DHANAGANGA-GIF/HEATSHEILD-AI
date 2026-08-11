import { CommunityCluster, CommunityReport } from './types';

// Haversine distance in KM
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function detectCommunityClusters(
  reports: CommunityReport[],
  radiusKm: number = 3.0,
  minReports: number = 2
): CommunityCluster[] {
  const clusters: CommunityCluster[] = [];
  const processedReportIds = new Set<string>();

  reports.forEach((report, i) => {
    if (processedReportIds.has(report.id)) return;

    const group = [report];
    for (let j = i + 1; j < reports.length; j++) {
      const candidate = reports[j];
      if (processedReportIds.has(candidate.id)) continue;

      const dist = calculateDistanceKm(
        report.location.latitude,
        report.location.longitude,
        candidate.location.latitude,
        candidate.location.longitude
      );

      if (dist <= radiusKm) {
        group.push(candidate);
      }
    }

    if (group.length >= minReports) {
      group.forEach(r => processedReportIds.add(r.id));

      const avgLat = group.reduce((acc, r) => acc + r.location.latitude, 0) / group.length;
      const avgLon = group.reduce((acc, r) => acc + r.location.longitude, 0) / group.length;

      clusters.push({
        id: `cls_${Date.now()}_${i}`,
        category: group[0].category,
        report_ids: group.map(r => r.id),
        center_latitude: avgLat,
        center_longitude: avgLon,
        radius_km: radiusKm,
        report_count: group.length,
        status_label: 'POTENTIAL COMMUNITY ISSUE',
        detected_at: new Date().toISOString(),
      });
    }
  });

  return clusters;
}
