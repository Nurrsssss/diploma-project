export const getPageTitle = (
    path: string,
    items: { label: string; href: string }[] = []): string => {

    const found = items.find(item => item.href === path);
    return found ? found.label : 'Clintech';
}
