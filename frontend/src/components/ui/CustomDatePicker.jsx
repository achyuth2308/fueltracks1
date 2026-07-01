import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const CustomDatePicker = ({ value, onChange, style, max }) => {
  // Convert string 'YYYY-MM-DD' to Date object
  let selectedDate = null;
  if (value) {
    const [y, m, d] = value.split('-');
    if (y && m && d) {
      selectedDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
  }

  let maxDate = null;
  if (max) {
    const [y, m, d] = max.split('-');
    if (y && m && d) {
      maxDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
  }

  const handleChange = (date) => {
    if (!date) {
      onChange({ target: { value: '' } });
      return;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    // Emulate event object for existing onChange handlers
    onChange({ target: { value: `${year}-${month}-${day}` } });
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

  return (
    <DatePicker
      selected={selectedDate}
      onChange={handleChange}
      dateFormat="dd-MM-yyyy"
      maxDate={maxDate}
      customInput={<input style={defaultStyle} />}
    />
  );
};

export default CustomDatePicker;
