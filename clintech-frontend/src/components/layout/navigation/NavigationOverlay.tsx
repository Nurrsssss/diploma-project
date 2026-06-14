interface INavigationOverlayProps {
    isVisible: boolean;
    onClick: () => void;
}

export const NavigationOverlay: React.FC<INavigationOverlayProps> = ({
    isVisible,
    onClick
}) => {
    return (
        <div
            className={`
                fixed inset-0 z-30 lg:hidden transition-opacity duration-300
                ${isVisible ? 'opacity-100 bg-black/20' : 'opacity-0 pointer-events-none'}
            `}
            onClick={onClick}
        />
    );
};