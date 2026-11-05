import { EventBus } from '../core/EventBus';

export type TextParams = Readonly<Record<string, string | number>>;

/** BigHero LanguageCatalog + LanguageText: one instance-owned table, `{name}` templates. */
export class I18n {
    static current: I18n;
    static readonly CHANGED = 'i18n.changed';

    private table: Readonly<Record<string, string>> = {};
    language = '';

    constructor(private readonly bus: EventBus) {}

    setTable(language: string, table: Readonly<Record<string, string>>): void {
        this.language = language;
        this.table = table;
        this.bus.send(I18n.CHANGED);
    }

    t(key: string, params?: TextParams): string {
        const template = this.table[key];
        if (template === undefined) throw new Error('Missing text key: ' + key);
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (_match: string, name: string) => {
            const value = params[name];
            if (value === undefined) throw new Error('Missing param {' + name + '} for ' + key);
            return String(value);
        });
    }

    onChanged(enabled: boolean, handler: () => void, context: unknown): void {
        this.bus.changeListener(enabled, I18n.CHANGED, handler, context);
    }
}
