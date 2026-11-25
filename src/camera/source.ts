export function createRtspsSource(host: string, accessCode: string, trustSelfSigned: boolean) {
  return {
    uri: `rtsps://bblp:${encodeURIComponent(accessCode)}@${host}:322/streaming/live/1`,
    initType: 2 as const,
    initOptions: ['--quiet', '--rtsp-tcp', '--network-caching=250', '--no-audio', '--no-video-title-show'],
    acceptInvalidCertificates: trustSelfSigned,
  };
}
