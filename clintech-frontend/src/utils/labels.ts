export function getLabel(options: { label: string; value: string }[], value: string) {
    const found = options.find(opt => opt.value === value);
    return found ? found.label : value;
}

export function getLabels(options: { label: string; value: string }[], values: string[] | undefined) {
    if (!values || values.length === 0) return 'Не указано';
    return values.map(val => getLabel(options, val)).join(', ');
}