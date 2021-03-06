import { Component, OnInit, Input, Output, EventEmitter, ViewChild, ElementRef, TemplateRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Ymd, NiDatetime, NiDatetimeLocale, Locales, formatDate, padNumber, toTimezone } from 'ni-datetime';
import { ValueChange, ViewDate, ViewMonth, LocaleChangeEvent, ViewUpdateEvent } from './ni-datetime-picker';

@Component({
  selector: 'ni-datetime-picker',
  templateUrl: './ni-datetime-picker.component.html',
  styleUrls: ['./ni-datetime-picker.component.less']
})
export class NiDatetimePickerComponent implements OnInit, AfterViewInit, OnDestroy {

  /*
   * attributes prefix notation
   *------------------------------
   * __ => only in component, eg: __value
   * _  => in component and view, eg: _dateOrarray(...)
   *    => public, eg: value
   */
  _inited = false;

  __disabled = false;
  @Input() set disabled(value: boolean) {
    if (value && !this.inline) { this.openDialog = false; }
    this.__disabled = value;
  }
  get disabled() { return this.__disabled; }

  __value: any; // Date|Date[]
  @Input()
  set value(value: any) {
    if ((typeof value) === "string") {
      try { value = new Date(value); } catch (exp) { }
    }

    this._setValue(value, false);

    if (this.calendar) {
      this.calendar.use(this._firstDateValue(this.value));
      this.__updateView();
    }
  }
  get value(): any {
    return this.__value;
  }
  _firstDateValue(value: any) {
    if (Array.isArray(value)) {
      return value.length ? value[0] : null;
    } else {
      return value;
    }
  }
  _dateORarray(value: any) {
    if (this.isSingleSelection) {
      return this._firstDateValue(value);
    } else if (Array.isArray(value)) {
      return value;
    } else if (value) {
      return [value];
    } else {
      return value; // is null
    }
  }
  _dateArray(value: any) {
    return this.isSingleSelection ? (value ? [value] : []) : (Array.isArray(value) ? value : []);
  }

  @Output() valueChange = new EventEmitter<any>();
  @Output() valueChanged = new EventEmitter<ValueChange | ValueChange[]>();
  _setValue(value: any, emit = true) {
    this.__value = this._dateORarray(value);
    this._updateInputfield();

    if (emit && this.calendar && this._inited) {
      this.valueChange.emit(this.__copy(value));

      const helpers = this.__viewDateStateHelper();

      if (!this.value) {
        this.valueChanged.emit({});
      } else if (this.isSingleSelection) {
        const vdate = helpers.calendar.use(this.value).ymd;
        this.__updateViewDateState(vdate, helpers);

        this.valueChanged.emit({
          date: new Date(this.value),
          viewDate: vdate,
          viewDateFormatted: this._getFormatted(this.inputFormat, this.value)
        });
      } else {
        const vdates = [];
        this.value.forEach((date: Date) => {
          const vdate = helpers.calendar.use(date).ymd;
          this.__updateViewDateState(vdate, helpers);
          vdates.push({
            date: new Date(date),
            viewDate: vdate,
            viewDateFormatted: this._getFormatted(this.inputFormat, date)
          });
        });
        this.valueChanged.emit(vdates);
      }
    }
  }

  // use for the view if value is null
  @Input() defaultDate: Date;

  __monthPicker = false;
  __prevNumberOfMonths = null;
  @Input()
  set monthPicker(value: boolean) {
    this.__monthPicker = value;

    // remember and switch back to previous numberOfMonths
    if (this.__monthPicker) {
      this.__prevNumberOfMonths = this.__numberOfMonths;
    } else {
      this.__numberOfMonths = this.__prevNumberOfMonths;
    }

    this.__computeUiElementsWidth();
    this.__updateView(true, false);
  }
  get monthPicker() {
    return this.__monthPicker;
  }

  __datePicker = true;
  @Input()
  set datePicker(value: boolean) {
    this.__datePicker = value;
    this.__computeUiElementsWidth();
    this.__updateView(true, false);
  }
  get datePicker() {
    return this.__datePicker;
  }

  __timePicker = false;
  @Input()
  set timePicker(value: boolean) {
    this.__timePicker = value;
    this.__computeUiElementsWidth();
    this.__updateView(true, false);
  }
  get timePicker() {
    return this.__timePicker;
  }

  __inline = false;
  @Input()
  set inline(value: boolean) {
    this.__inline = value;
    this.__computeUiElementsWidth();
    if (this.__inline) {
      this.openDialog = true;
    } else {
      this.__manageOverlay();
    }
  }
  get inline() {
    return this.__inline;
  }

  __locales: string[] = Object.keys(Locales);
  @Input() set locales(locales: string[]) {
    this.__locales = locales.filter(each => each in Locales);
  }
  get locales(): string[] {
    return this.__locales;
  }

  @Input() showLocaleSwitch = false;
  __locale: NiDatetimeLocale = Locales.fa_AF;
  @Output() localeChange = new EventEmitter<string>();
  @Input()
  set locale(value: any) {
    this._updateLocale(value, false);
  }
  get locale(): any {
    return this.__locale;
  }

  _getFormatted(format: string, value: any) {
    if (format && value && this.calendar) {
      const formatted = [],
        calendar = this.calendar.clone(),
        perform = (date: Date) =>
          formatted.push(formatDate(calendar.use(date), this.locale, format));

      if (Array.isArray(value)) {
        value.forEach(perform);
      } else {
        perform(value);
      }

      return formatted.join(this.selectedSeparator);
    } else {
      return '';
    }
  }

  @Input() monthDateLocales = [];

  __inputFormat = 'YYYY-MM-DD HH:mm AP';
  @Input()
  set inputFormat(value: string) {
    this.__inputFormat = value;
    this._updateInputfield();
  }
  get inputFormat() {
    return this.__inputFormat;
  }
  _updateInputfield() {
    this._inputFormatted = this._getFormatted(this.__inputFormat, this.value);
  }

  @Input() placeholder = '';

  __titleFormat = 'MMMM YYYY';
  @Input()
  set titleFormat(value: string) {
    this.__titleFormat = value;
    this._updateTitle();
  }
  get titleFormat() {
    return this.__titleFormat;
  }
  _updateTitle() {
    this._title = this._getFormatted(this.__titleFormat, this.calendar.__date);
  }

  __monthHeaderFormat = 'MMMM YYYY';
  @Input()
  set monthHeaderFormat(value: string) {
    this.__monthHeaderFormat = value;
    this._viewMonths.forEach(viewMonth => viewMonth.title
      = this._getFormatted(this.__monthHeaderFormat, viewMonth.value));
  }
  get monthHeaderFormat() {
    return this.__monthHeaderFormat;
  }

  @ViewChild('picker') picker: any;
  @ViewChild('modal') modal: any;
  @ViewChild('dialog') dialog: any;
  @Input() appendTo: any;

  @Output() showed = new EventEmitter<any>();
  @Output() hidded = new EventEmitter<any>();
  @Output() focused = new EventEmitter<any>();
  @Output() blurred = new EventEmitter<any>();
  @Output() viewUpdated = new EventEmitter<ViewUpdateEvent>();
  @Output() localeChanged = new EventEmitter<LocaleChangeEvent>();

  dialogWidth: string;
  monthWidth: string;

  __numberOfMonths = 1;
  @Input()
  set numberOfMonths(value: number) {
    this.__numberOfMonths = value;
    this.__computeUiElementsWidth();
    this.__manageOverlay();
    this.__updateView(true);
  }
  get numberOfMonths(): number {
    this.__computeUiElementsWidth();
    return this.__numberOfMonths;
  }

  __computeUiElementsWidth() {
    if (this.monthPicker) {
      this.dialogWidth = '250px';
      this.monthWidth = '33.333%';
      this.__numberOfMonths = 12;
    } else if (this.datePicker) {
      this.__numberOfMonths = Math.max(1, Math.min(12, this.__numberOfMonths)); // 1-12
      const columns = this.__numberOfMonths < 3 ? this.__numberOfMonths : 3;
      this.dialogWidth = `${columns * 250}px`;
      this.monthWidth = `${columns < 2 ? 100 : (columns < 3 ? 50 : 33.333)}%`;
    } else if (this.timePicker) {
      this.dialogWidth = '250px';
    }
  }

  __disabledDates: Date[] = [];
  @Input()
  set disabledDates(value: Date[]) {
    this.__disabledDates = value;
    this.__updateViewDatesStates();
  }
  get disabledDates() {
    return this.__disabledDates;
  }

  @Input() showWeekNums = false;

  __disableWeekends = false;
  @Input()
  set disableWeekends(value: boolean) {
    this.__disableWeekends = value;
    this.__updateViewDatesStates();
  }
  get disableWeekends() {
    return this.__disableWeekends;
  }

  get _todayDate() {
    return toTimezone(new Date(), this.targetTimezoneUTCOffset);
  }

  calendar: NiDatetime;
  get _today(): Ymd {
    return this.calendar
      ? this.calendar.clone().use(this._todayDate).ymd
      : null;
  }

  __selectedSeparator = ', '; // ', ' for multiple | ' - ' for range
  @Input()
  set selectedSeparator(value: string) {
    this.__selectedSeparator = value;
    this.__checkSelectedSeparator();
    this._updateInputfield();
  }
  get selectedSeparator(): string {
    return this.__selectedSeparator;
  }

  __checkSelectedSeparator() {
    if (this.selectedSeparator) {
      // it already has one
    } else if (this.isMultipleSelection) {
      this.__selectedSeparator = ', ';
    } else if (this.isRangeSelection) {
      this.__selectedSeparator = ' - ';
    }
  }

  __selectionMode = 'single';
  @Input()
  set selectionMode(value: string) {
    // it should be one of these value, or 'single' by default
    if (['single', 'multiple', 'range'].indexOf(value) < 0) {
      value = 'single';
    }

    this.__selectionMode = value;

    this.__checkSelectedSeparator();

    this._setValue(this.value, false);

    // for range, truncate to min and max
    if (this.isRangeSelection && this.value && this.value.length > 2) {
      this.__value = [
        Math.min.apply(null, this.value),
        Math.max.apply(null, this.value)
      ];
    }

    this._updateInputfield();
    this.__updateViewDatesStates();
  }
  get selectionMode() {
    return this.__selectionMode;
  }
  get isSingleSelection() { return this.selectionMode === 'single'; }
  get isMultipleSelection() { return this.selectionMode === 'multiple'; }
  get isRangeSelection() { return this.selectionMode === 'range'; }

  _inputFormatted = '';

  __openDialog = false;
  set openDialog(value: boolean) {
    const prev = this.__openDialog;

    this.__openDialog = value;

    if (value) {
      this.__updateView();
    }

    this.__manageOverlay();

    if (prev === value) {
      // ignore same value
    } else if (value && this._inited) {
      this.showed.emit({});
    } else if (this._inited) {
      this.hidded.emit({});
    }
  }
  get openDialog() {
    return this.__openDialog;
  }

  __dialogDetached = false;
  __detachDialog() {
    if (!this.__dialogDetached) {
      this.appendTo.appendChild(this.modal.nativeElement);
      this.__dialogDetached = true;
    }

    const appendToBound = this.appendTo.getBoundingClientRect(),
      dialog = this.dialog.nativeElement,
      pickerBound = this.picker.nativeElement.getBoundingClientRect(),
      rtlOffset = this.locale.dir === 'rtl' ? dialog.offsetWidth - pickerBound.width : 0;

    dialog.style.top = `${pickerBound.top - appendToBound.top + pickerBound.height}px`;
    dialog.style.left = `${pickerBound.left - appendToBound.left - rtlOffset}px`;

    dialog.classList.add("ni-dialog-visible");
  }
  __attachDialog() {
    if (this.__dialogDetached) {
      this.picker.nativeElement.appendChild(this.modal.nativeElement);
      this.__dialogDetached = false;
    }

    const dialog = this.dialog.nativeElement;
    dialog.style.top = "";
    dialog.style.left = "";
    dialog.classList.add("ni-dialog-visible");
  }
  __manageOverlay() {
    if (!this.appendTo) {
      // ignore; no appendTo is specified
    } else if (this.inline) {
      // inline - openDialog => attach if detached | later
      if (this.openDialog) {
        setTimeout(() => this.__attachDialog(), 0);
      }
      // inline - closeDialog => attach if detached | now
      else {
        this.__attachDialog();
      }
    } else {
      // normal - openDialog => detached if not detached | later
      if (this.openDialog) {
        setTimeout(() => this.__detachDialog(), 0);
      }
      // normal - closeDialog => attach if detached | now
      else if (this.dialog) {
        this.__attachDialog();
        // immediately remove dialog visiblility class
        this.dialog.nativeElement.classList.remove("ni-dialog-visible");
      }
    }
  }

  @Input() showPickerIcon = false;
  @Input() showClearBtn = false;
  @Input() clearBtnText = null;
  @Input() showTodayBtn = false;
  @Input() todayBtnText = null;
  @Input() todayBtnSet = "andValue"; // onlyView, andValue

  @Input() showYearNavigator = false;
  @Input() yearNavigatorRange = '';
  __yearNavRange = '';
  __yearNavValues = [];
  get yearNavValues() {
    if (this.__yearNavRange !== this.yearNavigatorRange) {
      const range = this.yearNavigatorRange.split(',').map(each => each.trim()).filter(each => each.length);
      if (range.length === 2) {
        // calculate the range
        const values = [];
        for (let start = parseInt(range[0]), end = parseInt(range[1]); start <= end; start++) {
          values.push(start);
        }

        this.__yearNavValues = values;
      } else if (range.length) {
        // use the values as the range
        this.__yearNavValues = range.map(each => parseInt(each.trim()));
      }
    }

    return this.__yearNavValues;
  }
  @Input() showMonthNavigator = false;
  get monthNavigatorValues() {
    return (this.locale as NiDatetimeLocale).monthsName;
  }

  get _navYear(): number { return this.calendar.year; }
  set _navYear(year: number) { this.__navYmChanged(year, null); }

  get _navMonth(): number { return this.calendar.month; }
  set _navMonth(month: number) { this.__navYmChanged(null, month); }

  __navYmChanged(year: number, month: number) {
    const ymd = this.calendar.ymd;
    if (year) { ymd.year = (year); }
    if (month) { ymd.month = (month); }
    this.calendar.ymd = ymd;
    this.__updateView();
  }

  _title = '';
  _viewMonthsMin: Date;
  _viewMonthsMax: Date;
  _viewMonths: ViewMonth[] = [];

  @ViewChild("titleDefaultTemplate", { static: true }) titleDefaultTemplate: TemplateRef<ElementRef>;
  @Input() titleTemplate: TemplateRef<ElementRef>;
  get _titleTemplate() { return this.titleTemplate || this.titleDefaultTemplate; }

  @ViewChild("monthDateDefaultTemplate", { static: true }) monthDateDefaultTemplate: TemplateRef<ElementRef>;
  @Input() monthDateTemplate: TemplateRef<ElementRef>;
  get _mdateTemplate() { return this.monthDateTemplate || this.monthDateDefaultTemplate; }

  @ViewChild("monthFooterDefaultTemplate", { static: true }) monthFooterDefaultTemplate: TemplateRef<ElementRef>;
  @Input() monthFooterTemplate: TemplateRef<ElementRef>;
  get _mfooterTemplate() { return this.monthFooterTemplate || this.monthFooterDefaultTemplate; }

  @ViewChild("monthTitleDefaultTemplate", { static: true }) monthTitleDefaultTemplate: TemplateRef<ElementRef>;
  @Input() monthTitleTemplate: TemplateRef<ElementRef>;
  get _mtitleTemplate() { return this.monthTitleTemplate || this.monthTitleDefaultTemplate; }

  @Input() navByScroll = true;
  @Input() navByTouch = true;
  __targetTimezoneUTCOffset = null;
  @Input() set targetTimezoneUTCOffset(offset: number) {
    this.__targetTimezoneUTCOffset = offset;
    this.__updateViewDatesStates();
  }
  get targetTimezoneUTCOffset() { return this.__targetTimezoneUTCOffset; }

  constructor() { }

  ngOnInit() { }
  ngAfterViewInit() { this._inited = true; }
  ngOnDestroy() { this._inited = false; }

  __copy(dates: any): any {
    if (!dates) { return dates; }
    const clone = (date: Date) => new Date(date);

    if (Array.isArray(dates)) {
      return dates.map(clone);
    } else {
      return clone(dates);
    }
  }

  _inputFocused($event: any) {
    if (this.disabled) return;

    this.openDialog = true;
    if (this._inited) {
      this.focused.emit({});
    }
  }

  _inputBlured($event: any) {
    if (this._inited) {
      this.blurred.emit({});
    }
  }

  _navToPreviousView() {
    if (this.disabled) return;

    const ymd = this.calendar.clone().ymd;
    ymd.month -= this.numberOfMonths;
    if (ymd.month < 1) {
      ymd.month = 12 - Math.abs(ymd.month);
      ymd.year -= 1;
    }
    this.calendar.ymd = ymd;
    this.__updateView();
  }

  _navToNextView() {
    if (this.disabled) return;

    const ymd = this.calendar.clone().ymd;
    ymd.month += this.numberOfMonths;
    if (ymd.month > 12) {
      ymd.month %= 12;
      ymd.year += 1;
    }
    this.calendar.ymd = ymd;
    this.__updateView();
  }

  _scrollIncrement($event: any) {
    if (this.navByScroll) {
      $event.preventDefault();
      // +/-[1-12]
      return ($event.deltaY < 0 ? -1 : 1) *
        Math.max(1, Math.min(12, Math.round($event.deltaY / 100)));
    } else {
      return 0;
    }
  }

  __touchStart = null;
  __unify(e: any) { return e.changedTouches ? e.changedTouches[0] : e };

  _logTouchStart($event: any) {
    if (this.navByTouch) {
      try { $event.preventDefault(); } catch (e) { }
      this.__touchStart = this.__unify($event).clientX;
    }
  }
  _touchIncrement($event: any) {
    if (this.navByTouch && this.__touchStart) {
      try { $event.preventDefault(); } catch (e) { }
      const increment = this.__unify($event).clientX - this.__touchStart;
      this.__touchStart = null;
      if (increment > 20) /* */ { return +1; }
      else if (increment < -20) { return -1; }
    }

    return 0;
  }

  _navBy(increment: number) {
    if (this.disabled) {
    } else if (increment < 0) {
      this._navToPreviousView();
    } else if (increment > 0) {
      this._navToNextView();
    }
  }

  _todayClicked($event: any) {
    if (this.todayBtnSet === 'onlyView') {
      this.calendar.ymd = this._today;
      this.__updateView();
    } else if (this.todayBtnSet === 'andValue') {
      const today = this._today as any;
      today.disabled = false;
      this._selectMonthDate(this._today);
    }
  }

  _monthDateClicked(viewDate: ViewDate) {
    if (this.disabled) return;

    this._selectMonthDate(viewDate);
  }

  _selectMonthDate(viewDate: ViewDate) {
    if (viewDate.disabled
      || viewDate.prev
      || viewDate.next) {
      return;
    }

    if (this.isSingleSelection) {
      this.calendar.ymd = viewDate;
      this._setValue(this.calendar.__date);
    } else {
      const value = this.value ? this.value : [],
        helper = this.calendar.clone(),
        matched = value.filter((date: Date) =>
          this.__isYmdInRange(viewDate, helper.use(date).ymd));

      if (matched.length) {
        value.splice(value.indexOf(matched[0]), 1);
      } else if (value.length === 2 && this.isRangeSelection) {
        helper.ymd = viewDate;
        value.splice(0, value.length, helper.__date);
      } else {
        helper.ymd = viewDate;
        value.push(helper.__date);
      }

      this._setValue(value);
    }

    if (this.inline || !this.isSingleSelection) {
      this.__updateView();
    } else {
      this.openDialog = false;
    }
  }

  __ymdInt(ymd: Ymd) {
    return (ymd.year * 10_000) + (ymd.month * 100) + ymd.date;
  }

  __isYmdInRange(value: ViewDate, first: ViewDate, last?: ViewDate) {
    if (!value || !first) {
      return false;
    } else if (!last) {
      last = first;
    }

    return this.__ymdInt(value) >= this.__ymdInt(first)
      && this.__ymdInt(value) <= this.__ymdInt(last);
  }

  __viewDateStateHelper() {
    const calendar = this.calendar.clone(),
      values = this._dateArray(this.value),
      valarr = values.map(date => calendar.use(date).ymd)
        .sort((a, b) => a.year - b.year || a.month - b.month || a.date - b.date);

    return {
      today: this._today,
      calendar: (calendar),
      selected: this.isRangeSelection && values.length === 2
        ? (date: ViewDate) => this.__isYmdInRange(date, valarr[0], valarr[1])
        : (date: ViewDate) => valarr.filter(value => this.__isYmdInRange(date, value)).length > 0
    };
  }

  __updateViewDatesStates() {
    if (!this.calendar) { return; }

    const helpers = this.__viewDateStateHelper();

    this._viewMonths.forEach(viewMonth => {
      viewMonth.dates.forEach(viewDate => {
        this.__updateViewDateState(viewDate, helpers);
      });
    });
  }

  __updateViewDateState(date: ViewDate, helpers: any) {
    date.today = this.__isYmdInRange(date, helpers.today);

    // by default disabled
    date.disabled = false;

    // is weekend? and is weekend disabled
    if (this.disableWeekends && date.weekend) {
      date.disabled = true;
    } else if (helpers.calendar) {
      // look in disabled dates
      for (const disabledDate of this.disabledDates) {
        helpers.calendar.use(disabledDate);
        if (this.__isYmdInRange(helpers.calendar.ymd, date)) {
          date.disabled = true;
          break;
        }
      }
    }

    date.selected = helpers.selected(date);
  }

  __updateView(force: boolean = false, emit = true) {
    let calendar = this.calendar;

    if (!calendar) {
      // we can't proceed if we don't have NiDatetime
      return;
    } else if (!calendar.__date) {
      calendar.use(this.defaultDate ? new Date(this.defaultDate) : this._todayDate);
    }

    calendar = calendar.clone();

    if (force) {
      this._viewMonthsMin = null;
      this._viewMonthsMax = null;
    }

    // update dialog title
    this._updateTitle();

    const vmin = this._viewMonthsMin,
      vmax = this._viewMonthsMax,
      date = calendar.__date.getTime();

    // only if given date is out or current view's range
    if (!vmin || date < vmin.getTime() || !vmax || date > vmax.getTime()) {
      const months = this.numberOfMonths;
      if (months % 3 === 0) {
        // in case of 3,6,9,12
        // start from 1,4,7,10
        const ymd = calendar.ymd;
        for (let i = 1; i < 12; i += months) {
          if (ymd.month < i + months) {
            ymd.month = i;
            break;
          }
        }
        ymd.date = 1;
        calendar.ymd = ymd;
      }

      // make sure calendar.date is 1
      const jumpTo1stDay = calendar.ymd;
      jumpTo1stDay.date = 1;
      calendar.ymd = jumpTo1stDay;

      // store view lower bound
      this._viewMonthsMin = new Date(calendar.__date);

      const viewMonths = [];
      // generate view dates
      for (let is = 0, ie = months; is < ie; is++) {
        viewMonths.push(this.__computeMonthDates(calendar));

        // move to next month
        const ymd = calendar.ymd;
        ymd.month += 1;
        if (ymd.month > 12) {
          ymd.year += 1;
          ymd.month = 1;
        }
        ymd.date = 1;
        calendar.ymd = ymd;
      }

      // store view upper bound
      // _.date is the 1st of next month
      // so deduct 24 hours from it
      this._viewMonthsMax = new Date(calendar.__date.getTime() - (24 * 3_600_000));

      this._viewMonths = viewMonths;

      if (emit && this.openDialog && this._inited) {
        this.viewUpdated.emit({
          viewMinDate: new Date(this._viewMonthsMin),
          viewMaxDate: new Date(this._viewMonthsMax)
        });
      }
    }

    this.__updateViewDatesStates();
  }

  __computeMonthDates(ndate: NiDatetime): ViewMonth {
    const mweekdays = [],
      mweeknums = [],
      cyear = ndate.year,
      cmonth = ndate.month;

    let mdates: ViewDate[] = [],
      locale1stday = 0,
      datesFrom = 0,
      datesUntil = 0;

    if (this.datePicker && !this.monthPicker) {
      // prev month
      const prev = ndate.clone(),
        pymd = prev.ymd;
      pymd.month -= 1;
      if (pymd.month < 1) {
        pymd.month = 12;
        pymd.year -= 1;
      }
      pymd.date = 15;
      prev.ymd = pymd;

      for (let count = prev.daysInMonth, day = count - 6; day <= count; day++) {
        mdates.push({ year: pymd.year, month: pymd.month, date: day, prev: true });
      }

      // current month
      locale1stday = this.locale.firstday;
      const week1stday = ndate.weeksFirstday,
        daysInMonth = ndate.daysInMonth,
        month1stday = mdates.length;
      for (let day = 1; day <= daysInMonth; day++) {
        mdates.push({ year: cyear, month: cmonth, date: day });
      }

      // next month
      const next = ndate.clone(),
        nymd = next.ymd;
      nymd.month += 1;
      if (nymd.month > 12) {
        nymd.month = 1;
        nymd.year += 1;
      }
      for (let day = 1; day < 7; day++) {
        mdates.push({ year: nymd.year, month: nymd.month, date: day, next: true });
      }

      // trim month dates
      const diff = this.__getFirstdaysDiff(locale1stday, week1stday),
        includedWeeks = (diff + daysInMonth) <= 35 ? 5 : 6;
      datesFrom = month1stday - diff;
      datesUntil = datesFrom + (includedWeeks * 7);

      mdates = mdates.slice(datesFrom, datesUntil);
      const weekends = this.locale.weekends;
      let lfirstday = locale1stday;
      mdates.forEach(date => {
        date.weekend = weekends.indexOf(lfirstday) >= 0;
        lfirstday = lfirstday !== 6 ? lfirstday + 1 : 0;
      });

      // add week nums
      const weeks = this.__getNumberOfWeeksUntil(ndate, cmonth);
      for (let week = weeks - includedWeeks + 1; week <= weeks; week++) {
        mweeknums.push(week);
      }

      // add weekday/ends
      const daysNames = this.locale.daysNameMini,
        weekdays = [...daysNames.slice(locale1stday), ...daysNames.slice(0, locale1stday)],
        zero2six = [0, 1, 2, 3, 4, 5, 6],
        indices = [...zero2six.slice(locale1stday), ...zero2six.slice(0, locale1stday)];
      for (let i = 0; i < weekdays.length; i++) {
        mweekdays.push({
          title: weekdays[i],
          weekend: weekends.indexOf(indices[i]) >= 0
        });
      }
    }

    const title = ndate.clone();
    title.ymd = { year: cyear, month: cmonth, date: 1 };

    this._attachRequestedLocales(ndate, mdates);
    const firstlast_days = mdates.filter(d => d.month === cmonth);

    const month = {
      value: new Date(ndate.__date),
      title: formatDate(title, this.locale, this.monthHeaderFormat),
      year: cyear,
      month: cmonth,
      date: 1,
      weeknums: mweeknums,
      weekdays: mweekdays,
      dates: mdates,
      firstday: firstlast_days[0],
      lastday: firstlast_days[firstlast_days.length - 1]
    };
    this._attachRequestedLocales(ndate, [month, month.firstday, month.lastday]);

    return month;
  }

  private _attachRequestedLocales(datetime: NiDatetime, dates: ViewDate[]) {
    if (!this.monthDateLocales) {
      return;
    }

    datetime = datetime.clone();

    this.monthDateLocales
      .filter(locale => Object.keys(Locales).indexOf(locale) >= 0)
      .forEach(locale => {
        const calendar = Locales[locale].new();
        dates.filter(obj => obj).forEach((ymd: any) => {
          datetime.ymd = ymd;
          calendar.use(new Date(
            datetime.__date.getFullYear(),
            datetime.__date.getMonth(),
            datetime.__date.getDate(),
            0, 0, 0));
          ymd[locale] = calendar.ymd;
        });
      });
  }

  __getNumberOfWeeksUntil(calendar: NiDatetime, month: number): number {
    calendar = calendar.clone();
    let firstday: number,
      dayscount = 0;

    for (let i = 1; i <= month; i++) {
      calendar.ymd = { year: calendar.year, month: i, date: 1 };
      if (i === 1) {
        firstday = calendar.weeksFirstday;
      }
      dayscount += calendar.daysInMonth;
    }

    return Math.ceil((dayscount + this.__getFirstdaysDiff(this.locale.firstday, firstday)) / 7);
  }

  __getFirstdaysDiff(locale1stday: number, week1stday: number) {
    if (locale1stday < week1stday) {
      return week1stday - locale1stday;
    } else if (locale1stday > week1stday) {
      return 7 - locale1stday + week1stday;
    } else {
      return 0;
    }
  }

  _updateTime() {
    // this.calendar.xxx is already updated in the view
    this._setValue(this.calendar.__date);
    this.__updateView();
  }

  _overlayClicked($event: any) {
    if (!this.inline) {
      this.openDialog = false;
    }
  }

  _pickerClicked($event: any) {
    if (this.disabled) return;

    // toggle open dialog
    this.openDialog = !this.openDialog;
  }

  _clearClicked($event: any) {
    this._setValue(null);

    if (this.inline) {
      this.__updateViewDatesStates();
    } else {
      this.openDialog = false;
    }
  }

  _updateLocale(locale: any, emit = true) {
    if (!locale) { return; }

    const prevLocale = this.__locale;

    // set the locale
    this.__locale = (typeof locale) === "string"
      ? Locales[locale as string] : locale;

    // initiate new calendar & use previous date value
    const prevCalendar = this.calendar;
    this.calendar = this.__locale.new();
    if (prevCalendar) {
      this.calendar.use(prevCalendar.__date);
    }

    this._updateInputfield();

    this.__manageOverlay();

    this.__updateView(true);

    if (emit && this._inited) {
      // emit locale changed value
      this.localeChange.emit(this.__locale.name);
    }

    if (emit && prevLocale.name !== this.__locale.name && this._inited) {
      // emit locale change event
      this.localeChanged.emit({ previous: prevLocale.name, locale: this.__locale.name });
    }
  }

  _pad(num: number, length: number) {
    return padNumber(num, length);
  }
}
