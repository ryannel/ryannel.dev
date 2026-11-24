import {securityFilms} from './security-film-data.mjs';

const directory='output/security-sequences/';
export function securitySequence(asset){
  return asset?.startsWith(directory)?securityFilms[asset.slice(directory.length)]:undefined;
}
export function sequenceFilm(kind){
  const data=securityFilms[kind];
  const overset=kind==='mixed'||kind==='key-pin';
  return {
    asset:directory+kind,captions:directory+kind+'.vtt',mediaRevision:'search-passes-1',cues:data.cues.map(([frame,,text])=>[frame,text]),
    stop:data.stop,label:overset?'Pause on the trapped key pin':'Pause on counter-rotation',
    replayFrom:data.replay,replayLabel:overset?'Replay the overset':'Replay the false set'
  };
}
