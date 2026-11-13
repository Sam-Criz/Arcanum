import { DatabaseSync as Database } from 'node:sqlite';
import { EnvironmentalService } from './environmental.service';
import { CampaignEventsService } from './campaign-events.service';
import { MasterNotesService } from './master-notes.service';
import { RevelationService } from './revelation.service';

export * from './master-tools.types';
export * from './environmental.service';
export * from './campaign-events.service';
export * from './master-notes.service';
export * from './revelation.service';

export class MasterToolsService {
  public environmental: EnvironmentalService;
  public events: CampaignEventsService;
  public notes: MasterNotesService;
  public revelations: RevelationService;

  constructor(private db: Database) {
    this.environmental = new EnvironmentalService(db);
    this.events = new CampaignEventsService(db);
    this.notes = new MasterNotesService(db);
    this.revelations = new RevelationService(db);
  }
}
