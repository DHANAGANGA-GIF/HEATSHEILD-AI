import { ActivityLevel, AgeGroup, CoolingAccess, ExposureDuration, RiskLevel, SafetyGuidance, WeatherData } from './types';

export function generatePersonalizedGuidance(
  riskLevel: RiskLevel,
  context: {
    activity: ActivityLevel;
    duration: ExposureDuration;
    cooling: CoolingAccess;
    age_group: AgeGroup;
  },
  weather: WeatherData
): SafetyGuidance[] {
  const guidance: SafetyGuidance[] = [];

  // Hydration Guidance
  const hydrationTitle = riskLevel === 'EXTREME' || riskLevel === 'HIGH' ? 'Prioritize Hydration Schedule' : 'Maintain Regular Hydration';
  guidance.push({
    id: 'g_hydration',
    category: 'hydration',
    title: hydrationTitle,
    technical_text: 'Maintain consistent fluid intake before, during, and after heat exposure. People with medical conditions or fluid restrictions should follow advice from their healthcare professional.',
    simple_text: 'Drink water regularly throughout the day. If your doctor has set fluid limits, follow their advice.',
    priority: riskLevel === 'EXTREME' || riskLevel === 'HIGH' ? 'urgent' : 'high',
  });

  // Cooling Guidance
  const coolingTitle = context.cooling === 'limited' ? 'Seek Available Shade & Cooling' : 'Utilize Active Cooling';
  guidance.push({
    id: 'g_cooling',
    category: 'cooling',
    title: coolingTitle,
    technical_text: 'Use shade, fan air circulation, or air-conditioned environments when possible to reduce core thermal equilibrium strain.',
    simple_text: 'Use shade or a cooler indoor room whenever possible to let your body cool down.',
    priority: riskLevel === 'EXTREME' ? 'urgent' : 'high',
  });

  // Exposure Guidance
  if (context.activity === 'high' || context.activity === 'moderate' || riskLevel === 'HIGH' || riskLevel === 'EXTREME') {
    guidance.push({
      id: 'g_exposure',
      category: 'exposure',
      title: 'Adjust Exposure Timing',
      technical_text: 'Consider reducing or rescheduling strenuous outdoor physical activity to early morning or evening hours when solar radiation is lowest.',
      simple_text: 'Try to do heavy outdoor work or exercise in the early morning or evening when it is cooler.',
      priority: riskLevel === 'EXTREME' ? 'urgent' : 'medium',
    });
  }

  // Rest Guidance
  guidance.push({
    id: 'g_rest',
    category: 'rest',
    title: 'Incorporate Work-Rest Intervals',
    technical_text: 'Use appropriate rest/cooling recovery periods during heat exposure, especially when performing continuous physical work.',
    simple_text: 'Take frequent short breaks in the shade to rest and catch your breath.',
    priority: context.duration === 'long' || riskLevel === 'HIGH' ? 'high' : 'medium',
  });

  // Community / Vulnerable Care
  if (context.age_group === 'older_adult' || context.age_group === 'child' || riskLevel === 'HIGH' || riskLevel === 'EXTREME') {
    guidance.push({
      id: 'g_community',
      category: 'community',
      title: 'Vulnerable Person Check-in',
      technical_text: 'Consider checking on neighbours, elderly relatives, children, or individuals who may be more vulnerable to high heat exposure.',
      simple_text: 'Check in on family members, neighbours, or elderly people who might need help staying cool.',
      priority: 'medium',
    });
  }

  return guidance;
}
