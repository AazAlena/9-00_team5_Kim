document.addEventListener('DOMContentLoaded', () => {
    //------ Slider Begin
    const CaroS = document.querySelector('.Carousel-slider');
    const CaroSlider = new MicroSlider(CaroS, { indicators: true, indicatorText: '' });
    const hammer = new Hammer(CaroS);
    const CaroSTimer = 2000;
    let CaroAutoplay = setInterval(() => CaroSlider.next(), CaroSTimer);
    //----- Mouseenter Event
    CaroS.onmouseenter = function(e) {
        clearInterval(CaroAutoplay);
    }
    //----- Mouseleave Event
    CaroS.onmouseleave = function(e) {
        clearInterval(CaroAutoplay);
        CaroAutoplay = setInterval(() => CaroSlider.next(), CaroSTimer);
    }
    //----- Mouseclick Event
    CaroS.onclick = function(e) {
        clearInterval(CaroAutoplay);
        
    }
    //------ Gesture Tap Event
    hammer.on('tap', function(e) {
        clearInterval(CaroAutoplay);
    });
   
    //----- Gesture Swipe Event
    hammer.on('swipe', function(e) {
        clearInterval(CaroAutoplay);
        CaroAutoplay = setInterval(() => CaroSlider.next(), CaroSTimer);
    });

    let slideLink = document.querySelectorAll('.slider-item');
    if (slideLink && slideLink !== null && slideLink.length > 0) {
        slideLink.forEach(el => el.addEventListener('click', e => {
            e.preventDefault();
            let href = el.dataset.href;
            let target = el.dataset.target;
            if (href !== '#') window.open(href, target);
        }));
    }

    //---- Slider End
    
});