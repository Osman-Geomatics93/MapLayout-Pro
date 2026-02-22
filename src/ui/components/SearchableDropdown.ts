/**
 * SearchableDropdown — Lightweight searchable dropdown component.
 *
 * Vanilla TS + DOM, no external dependencies.
 * Matches existing MapLayout Pro design system variables.
 */

export interface DropdownOption {
  value: string;
  label: string;
  /** Optional extra data attached to this option */
  data?: unknown;
}

export interface SearchableDropdownConfig {
  container: HTMLElement;
  placeholder?: string;
  label?: string;
  onSelect?: (option: DropdownOption) => void;
}

export class SearchableDropdown {
  private root: HTMLDivElement;
  private labelEl: HTMLLabelElement | null = null;
  private control: HTMLDivElement;
  private input: HTMLInputElement;
  private clearBtn: HTMLButtonElement;
  private spinner: HTMLDivElement;
  private list: HTMLUListElement;

  private options: DropdownOption[] = [];
  private filtered: DropdownOption[] = [];
  private selectedValue: string | null = null;
  private isOpen = false;
  private enabled = true;
  private onSelect: ((option: DropdownOption) => void) | null;

  private errorMessage: string | null = null;

  constructor(config: SearchableDropdownConfig) {
    this.onSelect = config.onSelect ?? null;

    // Root wrapper
    this.root = document.createElement('div');
    this.root.className = 'searchable-dropdown';

    // Label
    if (config.label) {
      this.labelEl = document.createElement('label');
      this.labelEl.className = 'sd-label';
      this.labelEl.textContent = config.label;
      this.root.appendChild(this.labelEl);
    }

    // Control (input + icons)
    this.control = document.createElement('div');
    this.control.className = 'sd-control';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'sd-input';
    this.input.placeholder = config.placeholder ?? 'Select...';
    this.input.autocomplete = 'off';

    this.clearBtn = document.createElement('button');
    this.clearBtn.className = 'sd-clear hidden';
    this.clearBtn.type = 'button';
    this.clearBtn.innerHTML = '&times;';
    this.clearBtn.title = 'Clear selection';

    this.spinner = document.createElement('div');
    this.spinner.className = 'sd-spinner hidden';

    const chevron = document.createElement('div');
    chevron.className = 'sd-chevron';
    chevron.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>';

    this.control.appendChild(this.input);
    this.control.appendChild(this.spinner);
    this.control.appendChild(this.clearBtn);
    this.control.appendChild(chevron);
    this.root.appendChild(this.control);

    // Dropdown list
    this.list = document.createElement('ul');
    this.list.className = 'sd-list hidden';
    this.root.appendChild(this.list);

    config.container.appendChild(this.root);

    this.bindEvents();
  }

  private bindEvents(): void {
    // Focus → open
    this.input.addEventListener('focus', () => {
      if (!this.enabled) return;
      // If a value is selected, show all options but keep input text
      if (this.selectedValue) {
        this.filtered = this.options;
      } else {
        this.filterOptions(this.input.value);
      }
      this.openList();
    });

    // Typing → filter
    this.input.addEventListener('input', () => {
      if (!this.enabled) return;
      // If user starts typing after selection, deselect
      if (this.selectedValue) {
        this.selectedValue = null;
        this.clearBtn.classList.add('hidden');
      }
      this.filterOptions(this.input.value);
      this.openList();
    });

    // Escape → close
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeList();
        this.input.blur();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.focusNextItem(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.focusNextItem(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const active = this.list.querySelector('.sd-item-active') as HTMLLIElement | null;
        if (active) active.click();
      }
    });

    // Clear button
    this.clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clear();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.root.contains(e.target as Node)) {
        this.closeList();
      }
    });
  }

  private filterOptions(query: string): void {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.filtered = this.options;
    } else {
      this.filtered = this.options.filter((o) =>
        o.label.toLowerCase().includes(q)
      );
    }
    this.renderList();
  }

  private renderList(): void {
    this.list.innerHTML = '';

    if (this.errorMessage) {
      const li = document.createElement('li');
      li.className = 'sd-item sd-item-error';
      li.textContent = this.errorMessage;
      this.list.appendChild(li);
      return;
    }

    if (this.filtered.length === 0) {
      const li = document.createElement('li');
      li.className = 'sd-item sd-item-empty';
      li.textContent = 'No matches';
      this.list.appendChild(li);
      return;
    }

    // Limit rendered items for performance
    const limit = Math.min(this.filtered.length, 200);
    for (let i = 0; i < limit; i++) {
      const opt = this.filtered[i];
      const li = document.createElement('li');
      li.className = 'sd-item';
      if (opt.value === this.selectedValue) li.classList.add('sd-item-selected');
      li.textContent = opt.label;
      li.dataset.value = opt.value;
      li.addEventListener('click', () => this.selectOption(opt));
      li.addEventListener('mouseenter', () => {
        this.list.querySelectorAll('.sd-item-active').forEach((el) => el.classList.remove('sd-item-active'));
        li.classList.add('sd-item-active');
      });
      this.list.appendChild(li);
    }

    if (this.filtered.length > limit) {
      const li = document.createElement('li');
      li.className = 'sd-item sd-item-empty';
      li.textContent = `...and ${this.filtered.length - limit} more (type to filter)`;
      this.list.appendChild(li);
    }
  }

  private selectOption(opt: DropdownOption): void {
    this.selectedValue = opt.value;
    this.input.value = opt.label;
    this.clearBtn.classList.remove('hidden');
    this.closeList();
    this.onSelect?.(opt);
  }

  private openList(): void {
    if (!this.enabled) return;
    this.renderList();
    this.list.classList.remove('hidden');
    this.isOpen = true;
  }

  private closeList(): void {
    this.list.classList.add('hidden');
    this.isOpen = false;
    // If no selection, restore previous selected label
    if (this.selectedValue) {
      const selected = this.options.find((o) => o.value === this.selectedValue);
      if (selected) this.input.value = selected.label;
    }
  }

  private focusNextItem(direction: 1 | -1): void {
    const items = Array.from(this.list.querySelectorAll('.sd-item:not(.sd-item-empty):not(.sd-item-error)'));
    if (!items.length) return;

    const active = this.list.querySelector('.sd-item-active');
    let idx = active ? items.indexOf(active) : -1;
    items.forEach((el) => el.classList.remove('sd-item-active'));

    idx += direction;
    if (idx < 0) idx = items.length - 1;
    if (idx >= items.length) idx = 0;

    items[idx].classList.add('sd-item-active');
    items[idx].scrollIntoView({ block: 'nearest' });
  }

  // ─── Public API ────────────────────────────────────────────────────

  setOptions(options: DropdownOption[]): void {
    this.options = options;
    this.filtered = options;
    this.errorMessage = null;
    if (this.isOpen) this.renderList();
  }

  setLoading(loading: boolean): void {
    if (loading) {
      this.spinner.classList.remove('hidden');
      this.input.placeholder = 'Loading...';
    } else {
      this.spinner.classList.add('hidden');
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.input.disabled = !enabled;
    this.root.classList.toggle('sd-disabled', !enabled);
    if (!enabled) this.closeList();
  }

  setError(message: string): void {
    this.errorMessage = message;
    this.input.placeholder = message;
    if (this.isOpen) this.renderList();
  }

  clear(): void {
    this.selectedValue = null;
    this.input.value = '';
    this.clearBtn.classList.add('hidden');
    this.errorMessage = null;
    this.filtered = this.options;
    if (this.isOpen) this.renderList();
  }

  /** Set the selected value programmatically (e.g., from map click sync) */
  setValue(value: string, triggerCallback = false): void {
    const opt = this.options.find((o) => o.value === value);
    if (!opt) return;

    this.selectedValue = opt.value;
    this.input.value = opt.label;
    this.clearBtn.classList.remove('hidden');
    this.closeList();

    if (triggerCallback) {
      this.onSelect?.(opt);
    }
  }

  getSelectedValue(): string | null {
    return this.selectedValue;
  }

  setPlaceholder(text: string): void {
    this.input.placeholder = text;
  }

  destroy(): void {
    this.root.remove();
  }
}
