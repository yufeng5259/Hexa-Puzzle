import { Sprite } from 'cc';
import { LocalizedLabel } from '../../../framework/i18n/LocalizedLabel';
import { dailyRules, picnicPoints } from '../../domain/Daily';
import { services } from '../../Services';
import { MilestoneNode } from './MilestoneNode';

/** Shared picnic progress display of EventPage and EventDetailPage (F045). */
export function renderPicnic(progressLabel: LocalizedLabel, fill: Sprite, milestones: MilestoneNode[], rewardNoteLabel: LocalizedLabel): void {
    const rules = dailyRules().picnic;
    const points = picnicPoints(services.save.data);
    progressLabel.setParams({ value_1: points, value_2: rules.target });
    fill.fillRange = points / rules.target;
    milestones.forEach((node, i) => node.show(rules.marks[i], points));
    rewardNoteLabel.setParams({ value_1: rules.target, value_2: rules.honey });
}
