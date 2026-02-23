import { describe, test, expect, beforeEach } from 'vitest';
import { loadMock } from '../helpers/api-mocks';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Arbitration Schedule (/arbys)', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    // Load the rendered arbys.html fixture (PHP has been rendered via render-fixtures script)
    let html = readFileSync(join(process.cwd(), 'test/__fixtures__/arbys.html'), 'utf-8');
    html = html.replace(/<style>[\s\S]*?<\/style>/g, '<style></style>');

    dom = new JSDOM(html, {
      url: 'https://browse.wf/arbys'
    });
    document = dom.window.document;
  });

  describe('Data file: arbys.txt', () => {
    test('loads and parses correctly', () => {
      const arbysText = loadMock('arbys.txt');
      const lines = arbysText.trim().split('\n');

      // Should have multiple entries
      expect(lines.length).toBeGreaterThan(10);

      // Each line should be timestamp,nodeId format
      lines.forEach(line => {
        const parts = line.split(',');
        expect(parts.length).toBe(2);

        const timestamp = parseInt(parts[0]);
        const nodeId = parts[1].trim(); // Remove any trailing whitespace/carriage returns

        // Timestamp should be a valid unix timestamp (10 digits, starting with 1 or 2)
        expect(timestamp).toBeGreaterThan(1000000000);
        expect(timestamp).toBeLessThan(3000000000);

        // Node ID should be a string like "SolNode123" or "ClanNode1"
        expect(nodeId).toMatch(/^(Sol|Clan|Settlement)Node\d+$/);
      });
    });

    test('entries are chronologically ordered', () => {
      const arbysText = loadMock('arbys.txt');
      const lines = arbysText.trim().split('\n');

      let lastTimestamp = 0;
      lines.forEach(line => {
        const timestamp = parseInt(line.split(',')[0]);
        expect(timestamp).toBeGreaterThanOrEqual(lastTimestamp);
        lastTimestamp = timestamp;
      });
    });
  });

  describe('Data file: arbyTiers.js', () => {
    test('defines tier grades for node IDs', () => {
      const arbyTiersScript = readFileSync(join(process.cwd(), 'supplemental-data/arbyTiers.js'), 'utf-8');
      expect(arbyTiersScript).toContain('window.arbyTiers');

      // Should define tiers for various nodes
      expect(arbyTiersScript).toContain('SolNode');
      expect(arbyTiersScript).toContain('ClanNode');

      // Should have tier grades
      expect(arbyTiersScript).toMatch(/["']S["']/);
      expect(arbyTiersScript).toMatch(/["']A["']/);
      expect(arbyTiersScript).toMatch(/["']B["']/);
      expect(arbyTiersScript).toMatch(/["']C["']/);
      expect(arbyTiersScript).toMatch(/["']D["']/);
    });
  });

  describe('HTML structure: Dropdown selectors', () => {
    test('days selector has all expected options', () => {
      const select = document.getElementById('select-days') as HTMLSelectElement;
      expect(select).toBeTruthy();

      const values = Array.from(select.options).map(opt => opt.value);
      expect(values).toContain('1');   // 24 hours
      expect(values).toContain('7');   // 7 days
      expect(values).toContain('14');  // 14 days (default)
      expect(values).toContain('30');  // 30 days
      expect(values).toContain('90');  // 90 days
      expect(values).toContain('365'); // 12 months
      expect(values).toContain('9999999999'); // eon
    });

    test('days selector defaults to 14 days', () => {
      const select = document.getElementById('select-days') as HTMLSelectElement;
      const defaultOption = Array.from(select.options).find(opt => opt.selected);
      expect(defaultOption?.value).toBe('14');
    });

    test('timezone selector has local and UTC options', () => {
      const select = document.getElementById('select-tz') as HTMLSelectElement;
      expect(select).toBeTruthy();

      const values = Array.from(select.options).map(opt => opt.value);
      expect(values).toContain('local');
      expect(values).toContain('zulu');
    });

    test('hour format selector has all three formats', () => {
      const select = document.getElementById('select-hourfmt') as HTMLSelectElement;
      expect(select).toBeTruthy();

      const values = Array.from(select.options).map(opt => opt.value);
      expect(values).toContain('mil');  // military time
      expect(values).toContain('24');   // 24-hour time
      expect(values).toContain('12');   // 12-hour time
    });
  });

  describe('HTML structure: Checkbox filters', () => {
    test('all mission type checkboxes exist', () => {
      const missionTypes = [
        'MT_SURVIVAL', 'MT_DEFENSE', 'MT_TERRITORY', 'MT_EXCAVATE',
        'MT_PURIFY', 'MT_EVACUATION', 'MT_ARTIFACT', 'MT_CORRUPTION',
        'MT_VOID_CASCADE', 'MT_ARMAGEDDON', 'MT_ALCHEMY'
      ];

      missionTypes.forEach(type => {
        const checkbox = document.getElementById(`filter-${type}`) as HTMLInputElement;
        expect(checkbox, `filter-${type} should exist`).toBeTruthy();
        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(true); // All checked by default
      });
    });

    test('all tier checkboxes exist', () => {
      const tiers = ['S', 'A', 'B', 'C', 'D', 'F'];

      tiers.forEach(tier => {
        const checkbox = document.getElementById(`filter-tier-${tier}`) as HTMLInputElement;
        expect(checkbox, `filter-tier-${tier} should exist`).toBeTruthy();
        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(true);
      });
    });

    test('all faction checkboxes exist', () => {
      const factions = ['FC_GRINEER', 'FC_CORPUS', 'FC_INFESTATION', 'FC_OROKIN', 'FC_MITW'];

      factions.forEach(faction => {
        const checkbox = document.getElementById(`filter-${faction}`) as HTMLInputElement;
        expect(checkbox, `filter-${faction} should exist`).toBeTruthy();
        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(true);
      });
    });

    test('checkboxes have associated labels', () => {
      const allFilters = [
        'MT_SURVIVAL', 'MT_DEFENSE', 'MT_TERRITORY', 'MT_EXCAVATE',
        'tier-S', 'tier-A', 'FC_GRINEER', 'FC_CORPUS'
      ];

      allFilters.forEach(filter => {
        const checkbox = document.getElementById(`filter-${filter}`);
        const label = document.querySelector(`label[for="filter-${filter}"]`);
        expect(label, `label for filter-${filter} should exist`).toBeTruthy();
        expect(label?.textContent).toBeTruthy();
      });
    });
  });

  describe('HTML structure: Next occurrence table', () => {
    test('table exists with correct structure', () => {
      const table = document.querySelector('table');
      expect(table).toBeTruthy();

      const thead = table?.querySelector('thead');
      expect(thead).toBeTruthy();
      expect(thead?.textContent).toContain('Next Occurrence');

      const tbody = table?.querySelector('tbody');
      expect(tbody).toBeTruthy();
    });

    test('has rows for all mission types', () => {
      const missionTypes = [
        'MT_SURVIVAL', 'MT_DEFENSE', 'MT_TERRITORY', 'MT_EXCAVATE',
        'MT_PURIFY', 'MT_EVACUATION', 'MT_ARTIFACT', 'MT_CORRUPTION',
        'MT_VOID_CASCADE', 'MT_ARMAGEDDON', 'MT_ALCHEMY'
      ];

      missionTypes.forEach(type => {
        const row = document.getElementById(`next-${type}`);
        expect(row, `next-${type} row should exist`).toBeTruthy();

        // Row should have 3 columns: checkbox+label, date, details
        expect(row?.children.length).toBe(3);
      });
    });

    test('has rows for all tiers', () => {
      const tiers = ['S', 'A', 'B', 'C', 'D', 'F'];

      tiers.forEach(tier => {
        const row = document.getElementById(`next-tier-${tier}`);
        expect(row, `next-tier-${tier} row should exist`).toBeTruthy();
        expect(row?.children.length).toBe(3);
      });
    });

    test('has rows for all factions', () => {
      const factions = ['FC_GRINEER', 'FC_CORPUS', 'FC_INFESTATION', 'FC_OROKIN', 'FC_MITW'];

      factions.forEach(faction => {
        const row = document.getElementById(`next-${faction}`);
        expect(row, `next-${faction} row should exist`).toBeTruthy();
        expect(row?.children.length).toBe(3);
      });
    });
  });

  describe('HTML structure: Log container', () => {
    test('log element exists', () => {
      const log = document.getElementById('log');
      expect(log).toBeTruthy();
      expect(log?.textContent).toContain('Loading, please wait...');
    });

    test('layout has two-column structure', () => {
      const row = document.querySelector('.row');
      expect(row).toBeTruthy();

      const columns = row?.querySelectorAll('[class*="col-"]');
      expect(columns?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('URL fragment parameter support', () => {
    test('supports days parameter in URL structure', () => {
      // The arbys.ts code reads from URLSearchParams(location.hash.replace("#", ""))
      // This test verifies the selects have the right structure to be set programmatically
      const select = document.getElementById('select-days') as HTMLSelectElement;

      // Should be able to set these values programmatically
      select.value = '7';
      expect(select.value).toBe('7');

      select.value = '90';
      expect(select.value).toBe('90');
    });

    test('supports tz parameter in URL structure', () => {
      const select = document.getElementById('select-tz') as HTMLSelectElement;

      select.value = 'zulu';
      expect(select.value).toBe('zulu');

      select.value = 'local';
      expect(select.value).toBe('local');
    });

    test('supports hourfmt parameter in URL structure', () => {
      const select = document.getElementById('select-hourfmt') as HTMLSelectElement;

      select.value = '12';
      expect(select.value).toBe('12');

      select.value = '24';
      expect(select.value).toBe('24');
    });

    test('checkboxes can be unchecked programmatically for exclude parameter', () => {
      const checkbox = document.getElementById('filter-MT_SURVIVAL') as HTMLInputElement;

      expect(checkbox.checked).toBe(true);
      checkbox.checked = false;
      expect(checkbox.checked).toBe(false);
    });
  });

  describe('HTML structure: Tileset filters', () => {
    const tilesets = [
      'CorpusGasCityTileset', 'CorpusIcePlanetTileset', 'CorpusIcePlanetTilesetCaves',
      'CorpusOutpostTileset', 'CorpusShipTileset', 'EntratiTileset',
      'GrineerAsteroidTileset', 'GrineerForestTileset', 'GrineerGalleonTileset',
      'GrineerOceanTileset', 'GrineerSettlementTileset', 'GrineerShipyardsTileset',
      'InfestedCorpusShipTileset', 'OrokinDerelictTileset', 'OrokinMoonTilesetCorpus',
      'OrokinMoonTilesetGrineer', 'OrokinVoidTileset', 'ZarimanTileset'
    ];

    test('all tileset checkboxes exist', () => {
      tilesets.forEach(tileset => {
        const checkbox = document.getElementById(`filter-${tileset}`) as HTMLInputElement;
        expect(checkbox, `filter-${tileset} should exist`).toBeTruthy();
        expect(checkbox.type).toBe('checkbox');
        expect(checkbox.checked).toBe(true); // All checked by default
      });
    });

    test('has rows for all tilesets in Next Occurrence table', () => {
      tilesets.forEach(tileset => {
        const row = document.getElementById(`next-${tileset}`);
        expect(row, `next-${tileset} row should exist`).toBeTruthy();
        expect(row?.children.length).toBe(3);
      });
    });
  });

  describe('HTML structure: Table category headings', () => {
    test('has all category headings', () => {
      const headings = Array.from(document.querySelectorAll('tbody tr.category-heading'));
      expect(headings.length).toBe(4);

      expect(headings[0]?.textContent).toContain('Mission Types');
      expect(headings[1]?.textContent).toContain('Tiers');
      expect(headings[2]?.textContent).toContain('Factions');
      expect(headings[3]?.textContent).toContain('Tilesets');
    });
  });

  describe('HTML structure: Save/Load buttons', () => {
    test('Save settings button exists', () => {
      const btn = document.getElementById('btn-save-settings') as HTMLButtonElement;
      expect(btn, 'Save settings button should exist').toBeTruthy();
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.textContent).toContain('Save settings');
    });

    test('Load settings button exists and starts disabled', () => {
      const btn = document.getElementById('btn-load-settings') as HTMLButtonElement;
      expect(btn, 'Load settings button should exist').toBeTruthy();
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.textContent).toContain('Restore settings');
      expect(btn.disabled, 'Load button should start disabled').toBe(true);
    });
  });
});
