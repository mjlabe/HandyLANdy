import TcpSocket from 'react-native-tcp-socket';
import type { TlsSocketFactory } from './tls-types';

export const createNativeTlsSocket: TlsSocketFactory = (profile, port) => {
  // v6.4 supports rejectUnauthorized natively but omits it from its TS typedef.
  const options = { host: profile.host, port, connectTimeout: 15000, rejectUnauthorized: !profile.trustSelfSigned };
  return TcpSocket.connectTLS(options);
};
