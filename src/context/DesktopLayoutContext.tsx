import { createContext, useContext, useState, useCallback } from 'react';
import React from 'react';

interface TopBarProps {
    breadcrumbs: string;
    title: string;
    /** Page-level note shown behind an info icon beside the title. */
    titleInfo?: string;
    dateFilters?: any;
    sourceFilters?: any;
    extraContent?: React.ReactNode;
    onExport?: () => void;
    onBack?: () => void;
    subtitle?: any;
    leftAddon?: any;
    [key: string]: any;
}

/**
 * Default TopBar props when no screen has set them.
 */
const defaultTopBarProps: TopBarProps = {
    breadcrumbs: '',
    title: 'Dashboard',
    dateFilters: undefined,
    sourceFilters: undefined,
    extraContent: undefined,
    onExport: undefined,
    onBack: undefined,
};

const DesktopLayoutContext = createContext<{
    topBarProps: typeof defaultTopBarProps;
    setTopBarProps: (props: Partial<TopBarProps> | ((prev: TopBarProps) => TopBarProps) | null) => void;
}>({
    topBarProps: defaultTopBarProps,
    setTopBarProps: () => {},
});

export function DesktopLayoutProvider({ children }: { children: React.ReactNode }) {
    const [topBarProps, setTopBarPropsState] = useState(defaultTopBarProps);
    const setTopBarProps = useCallback((props: Partial<TopBarProps> | ((prev: TopBarProps) => TopBarProps) | null) => {
        setTopBarPropsState((prev) => {
            if (typeof props === 'function') return props(prev);
            if (props == null) return { ...defaultTopBarProps };
            return { ...defaultTopBarProps, ...props };
        });
    }, []);
    return (
        <DesktopLayoutContext.Provider value={{ topBarProps, setTopBarProps }}>
            {children}
        </DesktopLayoutContext.Provider>
    );
}

export function useDesktopTopBar() {
    const { setTopBarProps } = useContext(DesktopLayoutContext);
    return setTopBarProps;
}

export function useDesktopTopBarProps() {
    const { topBarProps } = useContext(DesktopLayoutContext);
    return topBarProps;
}

export default DesktopLayoutContext;
