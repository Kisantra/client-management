import { Field } from '@/components/leads/form-field';
import { ItemsEditor } from '@/components/letters/items-editor';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { FieldValue, ItemSection, LetterField } from '@/data/letters';

/**
 * One blank of a template, as the control its type calls for.
 *
 * The same component fills a letter and sets a template's default, so the
 * writer and the editor see the same thing for the same field.
 */
export function FieldEditor({
    field,
    value,
    onChange,
    error,
    disabled = false,
    idPrefix = 'field',
    labelOverride,
}: {
    field: LetterField;
    value: FieldValue | undefined;
    onChange: (next: FieldValue) => void;
    error?: string;
    disabled?: boolean;
    idPrefix?: string;
    /** The template editor calls the control "Isi awal" rather than by its label. */
    labelOverride?: string;
}) {
    const id = `${idPrefix}-${field.key}`;
    const text = typeof value === 'string' ? value : '';

    return (
        <Field
            id={id}
            label={labelOverride ?? field.label}
            hint={field.help ?? undefined}
            error={error}
            optional={!field.required && !labelOverride}
        >
            {field.type === 'items' ? (
                <ItemsEditor
                    id={id}
                    value={Array.isArray(value) ? (value as ItemSection[]) : []}
                    onChange={onChange}
                    disabled={disabled}
                />
            ) : field.type === 'select' ? (
                <Select
                    value={text}
                    onValueChange={(next) => onChange(next)}
                    disabled={disabled}
                >
                    <SelectTrigger id={id} className="w-full">
                        <SelectValue placeholder="Pilih…" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(field.options).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : field.type === 'textarea' ? (
                <Textarea
                    id={id}
                    value={text}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={field.placeholder ?? undefined}
                    disabled={disabled}
                    rows={4}
                />
            ) : field.type === 'list' ? (
                <Textarea
                    id={id}
                    value={text}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={field.placeholder ?? 'Satu butir per baris'}
                    disabled={disabled}
                    rows={4}
                    className="font-mono"
                />
            ) : field.type === 'date' ? (
                <Input
                    id={id}
                    type="date"
                    value={text}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={disabled}
                />
            ) : (
                <Input
                    id={id}
                    value={text}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={field.placeholder ?? undefined}
                    disabled={disabled}
                />
            )}
        </Field>
    );
}
