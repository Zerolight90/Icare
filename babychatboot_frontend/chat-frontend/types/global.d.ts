interface DaumPostcodeResult {
  address: string;
  roadAddress: string;
  addressType: string;
  bname: string;
  buildingName: string;
}

interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kakao: any;
  daum: {
    Postcode: new (opts: { oncomplete: (d: DaumPostcodeResult) => void }) => { open: () => void };
  };
}
