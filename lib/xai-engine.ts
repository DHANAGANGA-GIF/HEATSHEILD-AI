import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, RiskFactor, WeatherData } from './types';

export function calculateXAIContributions(
  weather: WeatherData,
  context: {
    activity: ActivityLevel;
    duration: ExposureDuration;
    cooling: CoolingAccess;
    age_group: AgeGroup;
  },
  riskScore: number
): RiskFactor[] {
  const factors: RiskFactor[] = [];

  // Temperature Factor
  const tempWeight = Math.min(45, Math.max(15, Math.round((weather.apparent_temperature / 45) * 40)));
  factors.push({
    name: 'Air & Apparent Temperature',
    category: 'temperature',
    impact: weather.apparent_temperature > 38 ? 'critical' : weather.apparent_temperature > 32 ? 'high' : 'moderate',
    weight_percent: tempWeight,
    description_technical: `Ambient temp (${weather.temperature}°C) with heat index yields ${weather.apparent_temperature}°C apparent thermal load.`,
    description_simple: `The air feels like ${weather.apparent_temperature}°C, which directly warms your body.`,
  });

  // Relative Humidity Factor
  const humWeight = Math.min(30, Math.round((weather.relative_humidity / 100) * 25));
  factors.push({
    name: 'Humidity & Evaporative Resistance',
    category: 'humidity',
    impact: weather.relative_humidity > 70 ? 'high' : weather.relative_humidity > 50 ? 'moderate' : 'low',
    weight_percent: humWeight,
    description_technical: `Relative humidity at ${weather.relative_humidity}% reduces cutaneous evaporative cooling effectiveness.`,
    description_simple: `High humidity (${weather.relative_humidity}%) prevents sweat from evaporating efficiently.`,
  });

  // Activity Level Factor
  let actWeight = 10;
  if (context.activity === 'moderate') actWeight = 18;
  if (context.activity === 'high') actWeight = 25;
  factors.push({
    name: 'Physical Activity Metabolic Rate',
    category: 'activity',
    impact: context.activity === 'high' ? 'critical' : context.activity === 'moderate' ? 'high' : 'low',
    weight_percent: actWeight,
    description_technical: `${context.activity.toUpperCase()} metabolic work level increases internal heat production.`,
    description_simple: `${context.activity === 'high' ? 'Strenuous activity' : context.activity === 'moderate' ? 'Moderate activity' : 'Light activity'} generates internal body heat.`,
  });

  // Exposure Duration Factor
  let durWeight = 8;
  if (context.duration === 'moderate') durWeight = 14;
  if (context.duration === 'long') durWeight = 20;
  factors.push({
    name: 'Heat Exposure Duration',
    category: 'exposure',
    impact: context.duration === 'long' ? 'high' : 'moderate',
    weight_percent: durWeight,
    description_technical: `${context.duration.toUpperCase()} continuous exposure leads to cumulative thermoregulatory strain.`,
    description_simple: `${context.duration === 'long' ? 'Extended time' : 'Moderate time'} spent in heat accumulates stress on your body.`,
  });

  // Cooling Access Factor
  let coolWeight = 5;
  if (context.cooling === 'limited') coolWeight = 15;
  factors.push({
    name: 'Cooling Infrastructure Access',
    category: 'exposure',
    impact: context.cooling === 'limited' ? 'high' : 'low',
    weight_percent: coolWeight,
    description_technical: `${context.cooling === 'good' ? 'Adequate' : 'Restricted'} air conditioning or shade recovery availability.`,
    description_simple: `${context.cooling === 'good' ? 'Good access' : 'Limited access'} to air conditioning or shade.`,
  });

  // Normalize weights to sum 100%
  const sumWeights = factors.reduce((acc, f) => acc + f.weight_percent, 0);
  if (sumWeights > 0) {
    factors.forEach(f => {
      f.weight_percent = Math.round((f.weight_percent / sumWeights) * 100);
    });
  }

  return factors.sort((a, b) => b.weight_percent - a.weight_percent);
}
