import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const generateTimeOptions = () => {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const ampm = h < 12 ? 'AM' : 'PM';
      const displayH = h === 0 ? 12 : (h > 12 ? h - 12 : h);
      const displayHH = String(displayH).padStart(2, '0');
      options.push({ value: `${hh}:${mm}`, label: `${displayHH}:${mm} ${ampm}` });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const CustomDatePicker = ({ value, onChange, style, max, showTime }) => {
  let selectedDate = null;
  let timeString = '00:00';
  
  if (value) {
    if (value.includes('T')) {
      const [datePart, timePart] = value.split('T');
      const [y, m, d] = datePart.split('-');
      const [hr, min] = timePart.split(':');
      if (y && m && d) {
        selectedDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      }
      if (hr && min) {
        timeString = `${hr}:${min}`;
      }
    } else {
      const [y, m, d] = value.split('T')[0].split('-');
      if (y && m && d) {
        selectedDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      }
    }
  }

  let maxDate = null;
  if (max) {
    const [y, m, d] = max.split('T')[0].split('-');
    if (y && m && d) {
      maxDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
  }

  const handleDateChange = (date) => {
    if (!date) {
      onChange({ target: { value: '' } });
      return;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (showTime) {
      onChange({ target: { value: `${year}-${month}-${day}T${timeString}` } });
    } else {
      onChange({ target: { value: `${year}-${month}-${day}` } });
    }
  };

  const handleTimeChange = (e) => {
    const newTime = e.target.value;
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      onChange({ target: { value: `${year}-${month}-${day}T${newTime}` } });
    } else {
      // If no date is selected yet, let's default to today when they pick a time
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      onChange({ target: { value: `${year}-${month}-${day}T${newTime}` } });
    }
  };

  const defaultStyle = {
    width: '100%', 
    padding: '10px 14px', 
    borderRadius: '10px', 
    border: '1px solid #CBD5E1', 
    outline: 'none', 
    boxSizing: 'border-box', 
    color: '#000000',
    fontFamily: 'inherit',
    ...style
  };

  if (showTime) {
    return (
      <div style={{ display: 'flex', gap: '8px', width: style?.width || '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="dd-MM-yyyy"
            maxDate={maxDate}
            customInput={<input style={{...defaultStyle, width: '100%'}} placeholder="Select Date" />}
          />
        </div>
        <div style={{ flex: '0 0 110px' }}>
          <select 
            value={timeString} 
            onChange={handleTimeChange} 
            style={{...defaultStyle, width: '100%', cursor: 'pointer', padding: '10px 8px'}}
          >
            {TIME_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleDateChange}
      dateFormat="dd-MM-yyyy"
      maxDate={maxDate}
      customInput={<input style={defaultStyle} placeholder="Select Date" />}
    />
  );
};

export default CustomDatePicker;
