import { DEBUG } from 'cc/env';
import { LocalStore } from '../../framework/storage/LocalStore';
import { SaveData } from './SaveData';
import { SaveStore } from './SaveService';

/** Development and release saves never share a key (F060). */
const KEY = DEBUG ? 'hexa.save.dev' : 'hexa.save.prod';

export class LocalSaveStore implements SaveStore {
    read(): SaveData | null { return LocalStore.read<SaveData>(KEY); }
    write(data: SaveData): void { LocalStore.write(KEY, data); }
}
