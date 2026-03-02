(module
  (memory (export "memory") 400)

  ;; ── clear framebuffer ──
  (func (export "clear") (param $w i32) (param $h i32) (param $color i32)
    (local $size i32) (local $i i32)
    (local.set $size (i32.mul (i32.mul (local.get $w) (local.get $h)) (i32.const 4)))
    (local.set $i (i32.const 0))
    (block $brk (loop $lp
      (br_if $brk (i32.ge_u (local.get $i) (local.get $size)))
      (i32.store (local.get $i) (local.get $color))
      (local.set $i (i32.add (local.get $i) (i32.const 4)))
      (br $lp))))

  ;; ── set pixel with alpha blending (ABGR format) ──
  (func $blendPixel (param $x i32) (param $y i32) (param $r i32) (param $g i32) (param $b i32) (param $a i32) (param $w i32) (param $h i32)
    (local $off i32) (local $dst i32) (local $dr i32) (local $dg i32) (local $db i32) (local $ia i32)
    (if (i32.and
          (i32.and (i32.ge_s (local.get $x) (i32.const 0)) (i32.lt_s (local.get $x) (local.get $w)))
          (i32.and (i32.ge_s (local.get $y) (i32.const 0)) (i32.lt_s (local.get $y) (local.get $h))))
      (then
        (local.set $off (i32.mul (i32.add (i32.mul (local.get $y) (local.get $w)) (local.get $x)) (i32.const 4)))
        (if (i32.ge_s (local.get $a) (i32.const 255))
          (then
            (i32.store (local.get $off)
              (i32.or (i32.const 0xFF000000)
                (i32.or (i32.shl (local.get $b) (i32.const 16))
                  (i32.or (i32.shl (local.get $g) (i32.const 8)) (local.get $r))))))
          (else
            (local.set $dst (i32.load (local.get $off)))
            (local.set $dr (i32.and (local.get $dst) (i32.const 0xFF)))
            (local.set $dg (i32.and (i32.shr_u (local.get $dst) (i32.const 8)) (i32.const 0xFF)))
            (local.set $db (i32.and (i32.shr_u (local.get $dst) (i32.const 16)) (i32.const 0xFF)))
            (local.set $ia (i32.sub (i32.const 255) (local.get $a)))
            ;; blended = (src * a + dst * (255-a)) / 255
            (local.set $dr (i32.div_u (i32.add (i32.mul (local.get $r) (local.get $a)) (i32.mul (local.get $dr) (local.get $ia))) (i32.const 255)))
            (local.set $dg (i32.div_u (i32.add (i32.mul (local.get $g) (local.get $a)) (i32.mul (local.get $dg) (local.get $ia))) (i32.const 255)))
            (local.set $db (i32.div_u (i32.add (i32.mul (local.get $b) (local.get $a)) (i32.mul (local.get $db) (local.get $ia))) (i32.const 255)))
            (i32.store (local.get $off)
              (i32.or (i32.const 0xFF000000)
                (i32.or (i32.shl (local.get $db) (i32.const 16))
                  (i32.or (i32.shl (local.get $dg) (i32.const 8)) (local.get $dr))))))))))

  ;; ── absolute value helper ──
  (func $abs (param $v i32) (result i32)
    (if (result i32) (i32.lt_s (local.get $v) (i32.const 0))
      (then (i32.sub (i32.const 0) (local.get $v)))
      (else (local.get $v))))

  ;; ── Bresenham line with alpha ──
  (func (export "drawLine")
    (param $x0 i32) (param $y0 i32) (param $x1 i32) (param $y1 i32)
    (param $r i32) (param $g i32) (param $b i32) (param $a i32)
    (param $w i32) (param $h i32)
    (local $dx i32) (local $dy i32) (local $sx i32) (local $sy i32) (local $err i32) (local $e2 i32) (local $steps i32) (local $maxSteps i32)
    (local.set $dx (call $abs (i32.sub (local.get $x1) (local.get $x0))))
    (local.set $dy (i32.sub (i32.const 0) (call $abs (i32.sub (local.get $y1) (local.get $y0)))))
    (local.set $sx (if (result i32) (i32.lt_s (local.get $x0) (local.get $x1)) (then (i32.const 1)) (else (i32.const -1))))
    (local.set $sy (if (result i32) (i32.lt_s (local.get $y0) (local.get $y1)) (then (i32.const 1)) (else (i32.const -1))))
    (local.set $err (i32.add (local.get $dx) (local.get $dy)))
    (local.set $steps (i32.const 0))
    (local.set $maxSteps (i32.mul (if (result i32) (i32.gt_s (local.get $w) (local.get $h)) (then (local.get $w)) (else (local.get $h))) (i32.const 4)))
    (block $done (loop $lp
      (call $blendPixel (local.get $x0) (local.get $y0) (local.get $r) (local.get $g) (local.get $b) (local.get $a) (local.get $w) (local.get $h))
      (br_if $done (i32.and (i32.eq (local.get $x0) (local.get $x1)) (i32.eq (local.get $y0) (local.get $y1))))
      (local.set $steps (i32.add (local.get $steps) (i32.const 1)))
      (br_if $done (i32.gt_s (local.get $steps) (local.get $maxSteps)))
      (local.set $e2 (i32.mul (i32.const 2) (local.get $err)))
      (if (i32.ge_s (local.get $e2) (local.get $dy)) (then
        (local.set $err (i32.add (local.get $err) (local.get $dy)))
        (local.set $x0 (i32.add (local.get $x0) (local.get $sx)))))
      (if (i32.le_s (local.get $e2) (local.get $dx)) (then
        (local.set $err (i32.add (local.get $err) (local.get $dx)))
        (local.set $y0 (i32.add (local.get $y0) (local.get $sy)))))
      (br $lp))))

  ;; ── scanline fill ──
  ;; edges at $edgeBase: packed as f32 x0,y0,x1,y1 (16 bytes per edge)
  ;; scratch buffer at $scratchBase for intersection x values (i32 array)
  (func (export "fillPoly")
    (param $edgeBase i32) (param $nEdges i32)
    (param $r i32) (param $g i32) (param $b i32) (param $a i32)
    (param $w i32) (param $h i32)
    (param $minY i32) (param $maxY i32)
    (param $scratchBase i32)
    (local $y i32) (local $i i32) (local $nHits i32)
    (local $ey0 f32) (local $ey1 f32) (local $ex0 f32) (local $ex1 f32)
    (local $yf f32) (local $ix f32) (local $tmp i32)
    (local $j i32) (local $k i32) (local $xStart i32) (local $xEnd i32)
    (local $eOff i32)

    ;; clamp minY/maxY to viewport
    (if (i32.lt_s (local.get $minY) (i32.const 0)) (then (local.set $minY (i32.const 0))))
    (if (i32.ge_s (local.get $maxY) (local.get $h)) (then (local.set $maxY (i32.sub (local.get $h) (i32.const 1)))))

    (local.set $y (local.get $minY))
    (block $ydone (loop $yloop
      (br_if $ydone (i32.gt_s (local.get $y) (local.get $maxY)))
      (local.set $yf (f32.add (f32.convert_i32_s (local.get $y)) (f32.const 0.5)))
      (local.set $nHits (i32.const 0))

      ;; find intersections with all edges
      (local.set $i (i32.const 0))
      (block $edone (loop $eloop
        (br_if $edone (i32.ge_s (local.get $i) (local.get $nEdges)))
        (local.set $eOff (i32.add (local.get $edgeBase) (i32.mul (local.get $i) (i32.const 16))))
        (local.set $ex0 (f32.load (local.get $eOff)))
        (local.set $ey0 (f32.load (i32.add (local.get $eOff) (i32.const 4))))
        (local.set $ex1 (f32.load (i32.add (local.get $eOff) (i32.const 8))))
        (local.set $ey1 (f32.load (i32.add (local.get $eOff) (i32.const 12))))

        ;; check if scanline crosses this edge
        (if (i32.or
              (i32.and (f32.le (local.get $ey0) (local.get $yf)) (f32.gt (local.get $ey1) (local.get $yf)))
              (i32.and (f32.le (local.get $ey1) (local.get $yf)) (f32.gt (local.get $ey0) (local.get $yf))))
          (then
            ;; compute intersection x = ex0 + (yf - ey0) / (ey1 - ey0) * (ex1 - ex0)
            (local.set $ix
              (f32.add (local.get $ex0)
                (f32.mul
                  (f32.div (f32.sub (local.get $yf) (local.get $ey0)) (f32.sub (local.get $ey1) (local.get $ey0)))
                  (f32.sub (local.get $ex1) (local.get $ex0)))))
            ;; store as i32 (truncated)
            (i32.store
              (i32.add (local.get $scratchBase) (i32.mul (local.get $nHits) (i32.const 4)))
              (i32.trunc_f32_s (local.get $ix)))
            (local.set $nHits (i32.add (local.get $nHits) (i32.const 1)))))

        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $eloop)))

      ;; insertion sort the hits
      (local.set $j (i32.const 1))
      (block $sdone (loop $sloop
        (br_if $sdone (i32.ge_s (local.get $j) (local.get $nHits)))
        (local.set $tmp (i32.load (i32.add (local.get $scratchBase) (i32.mul (local.get $j) (i32.const 4)))))
        (local.set $k (i32.sub (local.get $j) (i32.const 1)))
        (block $idone (loop $iloop
          (br_if $idone (i32.lt_s (local.get $k) (i32.const 0)))
          (br_if $idone (i32.le_s (i32.load (i32.add (local.get $scratchBase) (i32.mul (local.get $k) (i32.const 4)))) (local.get $tmp)))
          (i32.store
            (i32.add (local.get $scratchBase) (i32.mul (i32.add (local.get $k) (i32.const 1)) (i32.const 4)))
            (i32.load (i32.add (local.get $scratchBase) (i32.mul (local.get $k) (i32.const 4)))))
          (local.set $k (i32.sub (local.get $k) (i32.const 1)))
          (br $iloop)))
        (i32.store
          (i32.add (local.get $scratchBase) (i32.mul (i32.add (local.get $k) (i32.const 1)) (i32.const 4)))
          (local.get $tmp))
        (local.set $j (i32.add (local.get $j) (i32.const 1)))
        (br $sloop)))

      ;; fill between pairs
      (local.set $j (i32.const 0))
      (block $pdone (loop $ploop
        (br_if $pdone (i32.ge_s (i32.add (local.get $j) (i32.const 1)) (local.get $nHits)))
        (local.set $xStart (i32.load (i32.add (local.get $scratchBase) (i32.mul (local.get $j) (i32.const 4)))))
        (local.set $xEnd (i32.load (i32.add (local.get $scratchBase) (i32.mul (i32.add (local.get $j) (i32.const 1)) (i32.const 4)))))
        ;; clamp
        (if (i32.lt_s (local.get $xStart) (i32.const 0)) (then (local.set $xStart (i32.const 0))))
        (if (i32.ge_s (local.get $xEnd) (local.get $w)) (then (local.set $xEnd (i32.sub (local.get $w) (i32.const 1)))))
        ;; fill span
        (local.set $k (local.get $xStart))
        (block $fdone (loop $floop
          (br_if $fdone (i32.gt_s (local.get $k) (local.get $xEnd)))
          (call $blendPixel (local.get $k) (local.get $y) (local.get $r) (local.get $g) (local.get $b) (local.get $a) (local.get $w) (local.get $h))
          (local.set $k (i32.add (local.get $k) (i32.const 1)))
          (br $floop)))
        (local.set $j (i32.add (local.get $j) (i32.const 2)))
        (br $ploop)))

      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $yloop))))
)