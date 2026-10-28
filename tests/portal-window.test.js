import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {enablePortalWindow} from '../assets/mora-portal-window.js';

function setup() {
  const dom = new JSDOM('<section><header><h2>MORA</h2><button>Schliessen</button></header><textarea></textarea></section>', {url:'https://example.test',pretendToBeVisual:true});
  const w = dom.window, panel = w.document.querySelector('section'), header = panel.querySelector('header');
  w.innerWidth=1200;w.innerHeight=900;
  const defaults={left:700,top:200,width:440,height:620};
  const rect=()=>Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,parseFloat(panel.style.getPropertyValue('--mp-window-'+key))||value]));
  panel.getBoundingClientRect=rect;
  const layout=enablePortalWindow(panel,w);
  function pointer(target,type,x,y,id=1){
    const event=new w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});
    Object.defineProperties(event,{pointerId:{value:id},isPrimary:{value:true}});target.dispatchEvent(event);
  }
  const drag=(target,dx,dy)=>{pointer(target,'pointerdown',100,100);pointer(w,'pointermove',100+dx,100+dy);pointer(w,'pointerup',100+dx,100+dy);};
  const key=(target,key,shiftKey=false)=>target.dispatchEvent(new w.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true}));
  return {w,panel,header,rect,layout,pointer,drag,key,handle:direction=>panel.querySelector(`[data-resize="${direction}"]`)};
}

test('header drag moves the window, preserves size and stays on screen',()=>{
  const x=setup();try{
    x.drag(x.header,40,20);assert.deepEqual(x.rect(),{left:740,top:220,width:440,height:620});
    x.drag(x.header,-5000,-5000);assert.deepEqual(x.rect(),{left:12,top:12,width:440,height:620});
    x.drag(x.header,5000,5000);assert.deepEqual(x.rect(),{left:748,top:268,width:440,height:620});
    assert.equal(x.panel.classList.contains('mora-portal-moving'),false);
    x.panel.hidden=true;x.panel.hidden=false;x.layout.fit();assert.equal(x.rect().left,748);
    assert.equal(x.w.sessionStorage.length,0);assert.equal(x.w.localStorage.length,0);
  }finally{x.w.close();}
});

test('all four edges and four corners resize while the opposite edge stays anchored',()=>{
  for(const direction of ['n','e','s','w','ne','se','sw','nw']){
    const x=setup();try{
      const dx=direction.includes('w')?-20:20,dy=direction.includes('n')?-30:30;
      x.drag(x.handle(direction),dx,dy);
      assert.deepEqual(x.rect(),{left:direction.includes('w')?680:700,top:direction.includes('n')?170:200,
        width:/[ew]/.test(direction)?460:440,height:/[ns]/.test(direction)?650:620},direction);
    }finally{x.w.close();}
  }
});

test('resize respects minimum size and viewport bounds; smaller screens keep every edge reachable',()=>{
  const x=setup();try{
    x.drag(x.handle('se'),-2000,-2000);assert.deepEqual(x.rect(),{left:700,top:200,width:360,height:360});
    x.drag(x.handle('se'),2000,2000);assert.deepEqual(x.rect(),{left:700,top:200,width:488,height:688});
    x.w.innerWidth=800;x.w.innerHeight=500;x.w.dispatchEvent(new x.w.Event('resize'));
    assert.deepEqual(x.rect(),{left:300,top:12,width:488,height:476});
  }finally{x.w.close();}
});

test('Escape and pointer cancellation restore the window without triggering the chat close handler',()=>{
  const x=setup();let closed=0;
  x.panel.addEventListener('keydown',e=>{if(e.key==='Escape')closed++;});
  try{
    x.pointer(x.header,'pointerdown',100,100);x.pointer(x.w,'pointermove',50,150);x.key(x.header,'Escape');
    assert.deepEqual(x.rect(),{left:700,top:200,width:440,height:620});assert.equal(closed,0);
    x.drag(x.header,-100,-100);const before=x.rect();
    x.pointer(x.handle('se'),'pointerdown',100,100);x.pointer(x.w,'pointermove',200,200);x.pointer(x.w,'pointercancel',200,200);
    assert.deepEqual(x.rect(),before);assert.equal(x.panel.classList.contains('mora-portal-resizing'),false);
  }finally{x.w.close();}
});

test('keyboard provides move, resize and reset; ordinary buttons and typing never drag',()=>{
  const x=setup();try{
    x.drag(x.header.querySelector('button'),40,20);assert.equal(x.panel.style.length,0);
    x.key(x.header,'ArrowLeft');assert.equal(x.rect().left,690);
    x.key(x.handle('se'),'ArrowRight',true);assert.equal(x.rect().width,480);
    x.key(x.handle('se'),'ArrowUp');assert.equal(x.rect().height,610);
    x.key(x.header,'Home');assert.equal(x.panel.style.length,0);
    x.drag(x.panel.querySelector('textarea'),40,20);assert.equal(x.panel.style.length,0);
    x.drag(x.header,-30,10);x.header.dispatchEvent(new x.w.MouseEvent('dblclick',{bubbles:true}));assert.equal(x.panel.style.length,0);
  }finally{x.w.close();}
});

test('mobile disables dragging and restores the chosen desktop geometry on return',()=>{
  const x=setup();try{
    x.drag(x.header,-50,-50);const before=x.rect();
    x.w.innerWidth=390;x.w.dispatchEvent(new x.w.Event('resize'));assert.equal(x.header.tabIndex,-1);
    x.drag(x.header,50,50);x.drag(x.handle('se'),50,50);x.key(x.handle('se'),'ArrowRight');assert.deepEqual(x.rect(),before);
    x.w.innerWidth=1200;x.w.dispatchEvent(new x.w.Event('resize'));assert.equal(x.header.tabIndex,0);assert.deepEqual(x.rect(),before);
  }finally{x.w.close();}
});

test('secondary pointer and pointer movement after release cannot change the window',()=>{
  const x=setup();try{
    x.pointer(x.header,'pointerdown',100,100);x.pointer(x.w,'pointermove',50,50,2);assert.equal(x.panel.style.length,0);
    x.pointer(x.w,'pointermove',60,80);x.pointer(x.w,'pointerup',60,80);const before=x.rect();
    x.pointer(x.w,'pointermove',300,300);assert.deepEqual(x.rect(),before);
  }finally{x.w.close();}
});
