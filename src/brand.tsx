import { useEffect, useMemo, useState } from 'react';
import {
  bluehiveBrand,
  ccmeBrand,
  defaultBrand,
  enterpriseHealthBrand,
  generateBrandCSS,
  miewebBrand,
  ozwellBrand,
  wagglelineBrand,
  webchartBrand,
  type BrandConfig,
} from '@mieweb/ui/brands';

const BRAND_STORAGE_KEY = 'ozwell-manager-brand';
const BRAND_STYLE_ID = 'mieweb-runtime-brand';

export type BrandName =
  | 'ozwell'
  | 'mieweb'
  | 'bluehive'
  | 'enterprise-health'
  | 'webchart'
  | 'waggleline'
  | 'ccme'
  | 'default';

export const brandOptions: Array<{ label: string; value: BrandName }> = [
  { label: 'Ozwell', value: 'ozwell' },
  { label: 'MIE Web', value: 'mieweb' },
  { label: 'BlueHive', value: 'bluehive' },
  { label: 'Enterprise Health', value: 'enterprise-health' },
  { label: 'WebChart', value: 'webchart' },
  { label: 'Waggleline', value: 'waggleline' },
  { label: 'CCME', value: 'ccme' },
  { label: 'Default', value: 'default' },
];

const brandMap: Record<BrandName, BrandConfig> = {
  ozwell: ozwellBrand,
  mieweb: miewebBrand,
  bluehive: bluehiveBrand,
  'enterprise-health': enterpriseHealthBrand,
  webchart: webchartBrand,
  waggleline: wagglelineBrand,
  ccme: ccmeBrand,
  default: defaultBrand,
};

function isBrandName(value: string | null): value is BrandName {
  return !!value && value in brandMap;
}

export function applyBrand(brandName: BrandName) {
  const brand = brandMap[brandName];
  let styleElement = document.getElementById(BRAND_STYLE_ID);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = BRAND_STYLE_ID;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = generateBrandCSS(brand);
  document.documentElement.dataset.brand = brandName;
}

export function useBrand() {
  const [brand, setBrandState] = useState<BrandName>(() => {
    if (typeof window === 'undefined') return 'ozwell';
    const stored = window.localStorage.getItem(BRAND_STORAGE_KEY);
    return isBrandName(stored) ? stored : 'ozwell';
  });

  useEffect(() => {
    applyBrand(brand);
    window.localStorage.setItem(BRAND_STORAGE_KEY, brand);
  }, [brand]);

  const selectedBrand = useMemo(() => brandMap[brand], [brand]);

  return {
    brand,
    brandOptions,
    selectedBrand,
    setBrand: setBrandState,
  };
}

export function BrandInitializer({ brand }: { brand: BrandName }) {
  useEffect(() => {
    applyBrand(brand);
  }, [brand]);

  return null;
}
