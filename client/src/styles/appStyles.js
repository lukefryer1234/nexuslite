/**
 * App Styles - Extracted from App.jsx inline styles object
 * Apple OS-inspired design system
 */

export const styles = {
    app: {
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: '#0d0d0f',
        color: '#f5f5f7',
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        margin: 0,
        padding: 0
    },
    header: {
        background: 'linear-gradient(180deg, rgba(30,30,32,0.95) 0%, rgba(20,20,22,0.98) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 20px',
        fontSize: '0.95em',
        fontWeight: '600',
        letterSpacing: '0.3px',
        color: '#f5f5f7',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100,
        flexShrink: 0
    },
    headerLogo: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '1.1em',
        fontWeight: '700',
        background: 'linear-gradient(135deg, #a855f7, #6366f1)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
    },
    headerStats: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        fontSize: '12px',
        color: '#a1a1a6'
    },
    statItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    },
    statLabel: {
        color: '#6e6e73',
        fontWeight: '500'
    },
    statValue: {
        color: '#f5f5f7',
        fontWeight: '600'
    },
    mainLayout: {
        display: 'flex',
        flex: '1 1 0',
        overflow: 'hidden',
        background: '#0d0d0f',
        minHeight: 0
    },
    column: {
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'visible',
        overflowX: 'hidden',
        padding: '10px',
        gap: '10px',
        background: 'transparent',
        minWidth: 0
    },
    centerPanel: {
        width: '320px',
        minWidth: '320px',
        maxWidth: '320px',
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '12px',
        overflowY: 'auto',
        overflowX: 'hidden',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        boxSizing: 'border-box',
        zIndex: 5
    },
    controlPanel: {
        width: '80px',
        minWidth: '80px',
        background: 'rgba(255,255,255,0.01)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px',
        gap: '8px',
        overflowY: 'auto'
    },
    colHeader: (color) => ({
        textAlign: 'center',
        padding: '6px 10px',
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: '#fff',
        fontWeight: '600',
        fontSize: '10px',
        borderRadius: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        boxShadow: `0 2px 8px ${color}33`,
        flexShrink: 0
    }),
    colHeaderRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        marginBottom: '4px'
    },
    colControls: {
        display: 'flex',
        gap: '4px'
    },
    miniBtn: (color) => ({
        width: '24px',
        height: '24px',
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        border: 'none',
        borderRadius: '4px',
        color: 'white',
        fontSize: '11px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    }),
    miniBtnSecondary: {
        width: '24px',
        height: '24px',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '4px',
        color: '#888',
        fontSize: '14px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    terminalWrapper: {
        background: '#0a0a0c',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        height: '220px',
        minHeight: '220px',
        maxHeight: '220px',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        overflow: 'hidden'
    },
    termTitleBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
    },
    termTitlePanel: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    trafficLights: {
        display: 'flex',
        gap: '8px'
    },
    trafficLight: (color) => ({
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: color,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        opacity: 0.85
    }),
    termTitle: {
        fontSize: '12px',
        fontWeight: '500',
        color: '#a1a1a6',
        marginLeft: '8px'
    },
    controlGroup: {
        background: 'rgba(255,255,255,0.03)',
        padding: '16px',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'all 0.25s ease'
    },
    controlTitle: {
        fontSize: '11px',
        fontWeight: '600',
        color: '#6e6e73',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        marginBottom: '4px'
    },
    actionBtn: (color) => ({
        padding: '12px 16px',
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        border: 'none',
        borderRadius: '10px',
        color: 'white',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        textAlign: 'center',
        boxShadow: `0 4px 12px ${color}40`
    }),
    actionBtnSmall: (color) => ({
        padding: '4px 8px',
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        border: 'none',
        borderRadius: '6px',
        color: 'white',
        cursor: 'pointer',
        fontSize: '10px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        textAlign: 'center',
        boxShadow: `0 2px 6px ${color}30`
    }),
    actionBtnSecondary: {
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        color: '#f5f5f7',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '500',
        transition: 'all 0.2s ease',
        textAlign: 'center'
    },
    rebootBtn: {
        padding: '8px 16px',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        border: 'none',
        borderRadius: '8px',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
    },
    shutdownBtn: {
        padding: '8px 16px',
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        border: 'none',
        borderRadius: '8px',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalBox: {
        background: 'linear-gradient(180deg, #1f1f23 0%, #18181b 100%)',
        padding: '28px',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center',
        width: '380px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)'
    },
    modalTitle: {
        color: '#f5f5f7',
        fontSize: '18px',
        fontWeight: '600',
        marginTop: 0,
        marginBottom: '12px'
    },
    modalText: {
        color: '#a1a1a6',
        fontSize: '14px',
        marginBottom: '24px',
        lineHeight: '1.5'
    },
    termContainer: {
        flex: 1,
        overflow: 'hidden',
        padding: '8px 12px',
        background: '#0a0a0c'
    },
    sidebar: {
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 8px',
        gap: '8px',
        zIndex: 20,
        position: 'relative',
        transition: 'width 0.2s ease'
    },
    navItem: (active) => ({
        width: 'calc(100% - 8px)',
        height: '44px',
        borderRadius: '10px',
        background: active
            ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(99,102,241,0.15))'
            : 'transparent',
        border: active
            ? '1px solid rgba(168,85,247,0.3)'
            : '1px solid transparent',
        color: active ? '#f5f5f7' : '#6e6e73',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        userSelect: 'none',
        overflow: 'hidden',
        whiteSpace: 'nowrap'
    }),
    addPageBtn: {
        width: 'calc(100% - 8px)',
        height: '44px',
        borderRadius: '10px',
        background: 'transparent',
        border: '1px dashed rgba(255,255,255,0.15)',
        color: '#6e6e73',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        fontSize: '18px',
        fontWeight: '400',
        transition: 'all 0.2s ease'
    },
    resizeHandle: {
        position: 'absolute',
        right: -3,
        top: 0,
        bottom: 0,
        width: '6px',
        cursor: 'col-resize',
        zIndex: 100,
        transition: 'background 0.2s ease'
    },
    tabButton: (active) => ({
        flex: 1,
        padding: '10px 12px',
        background: active
            ? 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(99,102,241,0.15))'
            : 'rgba(255,255,255,0.03)',
        border: active
            ? '1px solid rgba(168,85,247,0.3)'
            : '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        color: active ? '#f5f5f7' : '#6e6e73',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        transition: 'all 0.2s ease'
    }),
    sectionTitle: {
        fontSize: '13px',
        fontWeight: '600',
        color: '#f5f5f7',
        textAlign: 'center',
        marginBottom: '16px'
    }
};

export default styles;
