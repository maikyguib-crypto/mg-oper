import './globals.css'
import PwaRegister from './pwa-register'
export const metadata = {
  title: 'MG Oper',
  description: 'Gestão diária de equipes e operações',
  applicationName: 'MG Oper',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MG Oper' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' }
}
export const viewport = { themeColor: '#0b111b', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }) {
  return <html lang="pt-BR"><body><PwaRegister />{children}</body></html>
}
