import React from 'react';
import Plotly from 'plotly.js';
import createPlotlyComponent from 'react-plotly.js/factory';
import Papa from 'papaparse';
import moment from 'moment';
import { simulate, sir } from './sir';

const Plot = createPlotlyComponent(Plotly);

async function getData(dataCSV) {
  return new Promise(resolve => {
    Papa.parse(dataCSV, {
      header: true,
      download: true,
      complete: results => {
        console.log('Complete', results.data.length, 'records.'); 
        resolve(results.data);
      }
    });
  });
};

async function getCovidHeader(dataCSV) {
  return new Promise(resolve => {
    Papa.parse(dataCSV, {
      preview: 1,
      download: true,
      complete: results => {
        console.log('Complete', results.data.length, 'records.'); 
        resolve(results.data);
      }
    });
  });
};

function filterCountry(data) {
  return data['Country/Region'] === this;
}

function newTrace(name, color) {
  return {
    x: [],
    y: [],
    name,
    line: {
      color,
      width: 3
    }
  };
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.covidHeader = null;
    this.covidCases = null;
    this.covidDeaths = null;
    this.covidRecovered = null;
    this.populationData = null;
    this.countries = new Set();

    this.state = {
      country: "Australia",
      population: 0,
      traces: [
        newTrace("Cases", "purple"),
        newTrace("Deaths", "orange"),
        newTrace("Recovered", "lime"),
        newTrace("Recovered + Deaths", "grey"),
        newTrace("Susceptible", "blue"),
        newTrace("Infected", "red"),
        newTrace("Recovered", "green"),
      ],
      layout: {
        datarevision: 0,
        width: 900,
        height: 700,
        title: "COVID-19 Australia"
      },
      revision: 0
    };

    this.handleCountryChange = this.handleCountryChange.bind(this);
    this.handleCountrySubmit = this.handleCountrySubmit.bind(this);
  }

  async componentDidMount() {
    // const covidCasesCSV = "https://data.humdata.org/hxlproxy/api/data-preview.csv?url=https%3A%2F%2Fraw.githubusercontent.com%2FCSSEGISandData%2FCOVID-19%2Fmaster%2Fcsse_covid_19_data%2Fcsse_covid_19_time_series%2Ftime_series_covid19_confirmed_global.csv&filename=time_series_covid19_confirmed_global.csv";
    // const covidDeathsCSV = "https://data.humdata.org/hxlproxy/api/data-preview.csv?url=https%3A%2F%2Fraw.githubusercontent.com%2FCSSEGISandData%2FCOVID-19%2Fmaster%2Fcsse_covid_19_data%2Fcsse_covid_19_time_series%2Ftime_series_covid19_deaths_global.csv&filename=time_series_covid19_deaths_global.csv";
    // const covidRecoveredCSV = "https://data.humdata.org/hxlproxy/api/data-preview.csv?url=https%3A%2F%2Fraw.githubusercontent.com%2FCSSEGISandData%2FCOVID-19%2Fmaster%2Fcsse_covid_19_data%2Fcsse_covid_19_time_series%2Ftime_series_covid19_recovered_global.csv&filename=time_series_covid19_recovered_global.csv";
    const covidCasesCSV = require("./datasets/covid_cases.csv");
    const covidDeathsCSV = require("./datasets/covid_deaths.csv");
    const covidRecoveredCSV = require("./datasets/covid_recovered.csv");
    const populationCSV = require("./datasets/population.csv");

    this.covidCases = await getData(covidCasesCSV);
    this.covidDeaths = await getData(covidDeathsCSV);
    this.covidRecovered = await getData(covidRecoveredCSV);
    this.populationData = await getData(populationCSV);

    this.covidHeader = await getCovidHeader(covidCasesCSV);
    this.covidHeader = this.covidHeader[0];

    for (let i = 0; i < this.covidCases.length; i++) {
      if (this.covidCases[i]['Country/Region']) {
        this.countries.add(this.covidCases[i]['Country/Region']);
      }
    }
    
    this.setCountryTraces();
  }

  async setCountryTraces() {
    const {traces, layout} = this.state;
    const filteredCovidCases = this.covidCases.filter(filterCountry, this.state.country);
    const filteredCovidDeaths = this.covidDeaths.filter(filterCountry, this.state.country);
    const filteredCovidRecovered = this.covidRecovered.filter(filterCountry, this.state.country);
    const population = this.populationData.filter(filterCountry, this.state.country);

    if (population) {
      this.state.population = population[0]["Population"];
    }

    for (const trace of traces) {
      trace.x = [];
      trace.y = [];
    }

    const cases = [];
    for (const header of this.covidHeader.slice(4)) {
      let casesSum = 0;
      let deathsSum = 0;
      let recoveredSum = 0;

      const m = moment(header, "MM/DD/YY");
      const formattedDate = m.format("YYYY-MM-DD");
      for (const trace of traces.slice(0, 4)) {
        trace.x.push(formattedDate);
      }

      let casesHere = 0;
      for (let j = 0; j < filteredCovidCases.length; j++){
        casesHere += parseInt(filteredCovidCases[j][header]);

        casesSum += parseInt(filteredCovidCases[j][header]);
        deathsSum += parseInt(filteredCovidDeaths[j][header]);
        recoveredSum += parseInt(filteredCovidRecovered[j][header]);
      }

      cases.push(casesHere);

      traces[0].y.push(casesSum);
      traces[1].y.push(deathsSum);
      traces[2].y.push(recoveredSum);
      traces[3].y.push(recoveredSum + deathsSum);
    }

    const pop = Number(population[0].Population);

    const t0 = traces[0];
    const t3 = traces[3];

    const lrCases = t0.y[t0.y.length - 1];
    const lrRes = t3.y[t3.y.length - 1];

    const S0 = pop - lrCases;
    const R0 = lrRes;
    const I0 = pop - (S0 + R0);
    
    const init = [S0, I0, R0].map(x => x / pop);
    
    const sol = simulate(sir(), 0, init, 1, 365);
    console.log(sol);

    const getDate = x => {
      const start = new Date(t0.x[t0.x.length - 1]);
      const date = new Date(start.getTime() + x * (24 * 60 * 60 * 1000));
      const m = moment(date.toISOString());
      return m.format("YYYY-MM-DD");
    };

    const i0 = traces.indexOf(traces.find(trace => trace.name === "Susceptible"));
    sol.y.forEach((ys, x) => {
      for (let i = i0+1; i < traces.length; i++) {
        traces[i].x.push(getDate(x));
        traces[i].y.push(Math.round(ys[i - i0] * pop));
      }
    });

    console.log(traces);

    layout.title = `COVID-19 ${this.state.country}`;
    await this.setState({ revision: this.state.revision + 1 });
    layout.datarevision = this.state.revision + 1;
  }

  createSelectItems() {
    let items = [];
    
    for (let item of this.countries) {
      items.push(<option key={item} value={item}>{item}</option>)
    }

    return items;
  }

  handleCountryChange(event) {
    this.setState({country: event.target.value});
  }

  handleCountrySubmit(event) {
    this.setCountryTraces();
    event.preventDefault();
  }

  render() {
    return (
      <div>
        <Plot
          data={this.state.traces}
          layout={this.state.layout}
          revision={this.state.revision}
        />
        <form onSubmit={this.handleCountrySubmit}>
          <label>
            Select a country:
            <select name="country" value={this.state.country} onChange={this.handleCountryChange}>
              {this.createSelectItems()}
            </select>
          </label>
          <input type="submit" value="Submit"/>
        </form>
      </div>
    );
  }
}

export default App;
