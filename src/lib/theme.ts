'use client'

import { createTheme } from '@mui/material/styles'

// Navy blue palette matching existing CSS custom properties
export const theme = createTheme({
  palette: {
    primary: {
      main: '#1A3260',
      light: '#2E4A80',
      dark: '#0F1F3D',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#C9A84C',
      light: '#d4ba6e',
      dark: '#a08038',
      contrastText: '#1a1a1a',
    },
    error: {
      main: '#d32f2f',
    },
    background: {
      default: '#fafafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1e2e',
      secondary: '#6b7080',
    },
    divider: 'rgba(26, 50, 96, 0.12)',
  },
  typography: {
    fontFamily: 'var(--font-geist-sans), "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: 'var(--font-heading), "Playfair Display", Georgia, serif' },
    h2: { fontFamily: 'var(--font-heading), "Playfair Display", Georgia, serif' },
    h3: { fontFamily: 'var(--font-heading), "Playfair Display", Georgia, serif' },
    h4: { fontFamily: 'var(--font-heading), "Playfair Display", Georgia, serif' },
    h5: { fontFamily: 'var(--font-heading), "Playfair Display", Georgia, serif' },
    h6: { fontFamily: 'var(--font-heading), "Playfair Display", Georgia, serif' },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid rgba(26, 50, 96, 0.12)',
        },
      },
      defaultProps: {
        elevation: 0,
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },
  },
})
